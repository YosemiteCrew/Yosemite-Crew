// src/services/sharedChatEntity.service.ts
import { StreamChat } from "stream-chat";
import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { ChatServiceError } from "src/services/chat.service";
import logger from "src/utils/logger";

const STREAM_KEY = process.env.STREAM_API_KEY!;
const STREAM_SECRET = process.env.STREAM_API_SECRET!;

if (!STREAM_KEY || !STREAM_SECRET) {
  throw new Error("Stream Chat credentials missing in env");
}

const streamServer = StreamChat.getInstance(STREAM_KEY, STREAM_SECRET);

// Group channels were created as Stream "team" channels; appointment and direct
// channels as "messaging" (see chat.service.ts channel creation).
const channelTypeForSession = (type: string): "team" | "messaging" =>
  type === "ORG_GROUP" ? "team" : "messaging";

export const SharedChatEntityType = {
  COMPANION: "COMPANION",
  APPOINTMENT: "APPOINTMENT",
  INVOICE: "INVOICE",
  FORM: "FORM",
  PRESCRIPTION: "PRESCRIPTION",
  DOCUMENT: "DOCUMENT",
} as const;

export type SharedChatEntityType =
  (typeof SharedChatEntityType)[keyof typeof SharedChatEntityType];

export type ShareEntityInput = {
  channelId: string;
  userId: string;
  entityType: SharedChatEntityType;
  entityId: string;
  title?: string;
  snapshot?: Record<string, unknown>;
};

/**
 * Load the chat session for a channel and assert the acting user is allowed to
 * share into it: the session must exist, be open, and the user must be a member.
 * The session's organisation is the authority for the share (the entity is
 * scoped to that org), so callers never need to trust an org id from the body.
 */
const loadAuthorisedSession = async (channelId: string, userId: string) => {
  const session = await prisma.chatSession.findFirst({ where: { channelId } });
  if (!session) {
    throw new ChatServiceError("Chat not found", 404);
  }
  if (session.status === "CLOSED") {
    throw new ChatServiceError("Chat is closed", 403);
  }
  if (!session.members.includes(userId)) {
    throw new ChatServiceError("User is not a member of this chat", 403);
  }
  return session;
};

type ShareScope = {
  organisationId: string;
  /** Set on a client-facing chat; null for staff-only chats. */
  parentId: string | null;
  patientId: string | null;
  appointmentId: string | null;
};

const notInOrg = () =>
  new ChatServiceError("Entity does not belong to this organisation", 403);

const notForThisClient = () =>
  new ChatServiceError("Entity does not belong to this chat", 403);

/**
 * A client-facing chat is about one client. Belonging to the organisation is
 * not enough there: without this, a staff member in a client's chat could share
 * a DIFFERENT client's pet, appointment or invoice into it. Staff-only chats
 * (no parent on the session) legitimately discuss any of the org's records, so
 * the organisation check remains the boundary for them.
 */
const assertEntityBelongsToClient = async (
  entityType: SharedChatEntityType,
  id: string,
  scope: ShareScope & { parentId: string },
): Promise<void> => {
  switch (entityType) {
    case SharedChatEntityType.COMPANION: {
      if (scope.patientId && scope.patientId === id) return;
      const link = await prisma.parentPatient.findFirst({
        where: { parentId: scope.parentId, patientId: id, status: "ACTIVE" },
        select: { id: true },
      });
      if (!link) throw notForThisClient();
      return;
    }
    case SharedChatEntityType.INVOICE: {
      const invoice = await prisma.invoice.findFirst({
        where: { id, organisationId: scope.organisationId },
        select: { parentId: true },
      });
      if (invoice?.parentId !== scope.parentId) throw notForThisClient();
      return;
    }
    case SharedChatEntityType.APPOINTMENT: {
      // The appointment's client lives in a JSON column, so there is no cheap
      // parent predicate. A client chat that names its appointment can only
      // share that one; one that does not falls back to the organisation check.
      if (scope.appointmentId && scope.appointmentId !== id) {
        throw notForThisClient();
      }
      return;
    }
    default:
      return;
  }
};

/**
 * Verify the entity being shared actually belongs where it is being shared: to
 * the session's organisation always, and to the session's client when the chat
 * has one. Only the entity types the product surfaces for sharing are accepted;
 * anything else is rejected rather than stored unverified.
 */
const assertEntityIsShareable = async (
  entityType: SharedChatEntityType,
  entityId: string,
  scope: ShareScope,
): Promise<void> => {
  const id = entityId.trim();
  if (!id) {
    throw new ChatServiceError("Invalid entity id", 400);
  }

  const { organisationId } = scope;

  switch (entityType) {
    case SharedChatEntityType.APPOINTMENT: {
      const found = await prisma.appointment.findFirst({
        where: { id, organisationId },
        select: { id: true },
      });
      if (!found) throw notInOrg();
      break;
    }
    case SharedChatEntityType.INVOICE: {
      const found = await prisma.invoice.findFirst({
        where: { id, organisationId },
        select: { id: true },
      });
      if (!found) throw notInOrg();
      break;
    }
    case SharedChatEntityType.COMPANION: {
      const link = await prisma.patientOrganisation.findFirst({
        where: {
          organisationId,
          patientId: id,
          status: { in: ["ACTIVE", "PENDING"] },
        },
        select: { id: true },
      });
      if (!link) throw notInOrg();
      break;
    }
    default:
      throw new ChatServiceError(
        `Sharing is not supported for ${entityType.toLowerCase()} entities`,
        400,
      );
  }

  if (scope.parentId) {
    await assertEntityBelongsToClient(entityType, id, {
      ...scope,
      parentId: scope.parentId,
    });
  }
};

export const SharedChatEntityService = {
  async shareEntity(input: ShareEntityInput) {
    const { channelId, userId, entityType, entityId, title, snapshot } = input;
    const session = await loadAuthorisedSession(channelId, userId);
    await assertEntityIsShareable(entityType, entityId, {
      organisationId: session.organisationId,
      parentId: session.parentId,
      patientId: session.patientId,
      appointmentId: session.appointmentId,
    });

    const channel = streamServer.channel(
      channelTypeForSession(session.type),
      channelId,
    );

    let messageId: string | undefined;
    try {
      const label = entityType.toLowerCase();
      const sent = await channel.sendMessage({
        text: title ? `Shared ${label}: ${title}` : `Shared a ${label}`,
        user_id: userId,
        sharedEntity: {
          entityType,
          entityId,
          title: title ?? null,
          snapshot: snapshot ?? null,
        },
      } as Parameters<typeof channel.sendMessage>[0]);
      messageId = sent.message?.id;
    } catch (err) {
      logger.error("Failed to post shared entity message to Stream", err);
      throw new ChatServiceError("Failed to share into chat", 502);
    }

    return prisma.sharedChatEntity.create({
      data: {
        organisationId: session.organisationId,
        channelId,
        sessionId: session.id,
        messageId,
        entityType,
        entityId,
        title: title ?? null,
        snapshot: snapshot
          ? (snapshot as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        sharedById: userId,
      },
    });
  },

  async listForChannel(channelId: string, userId: string) {
    await loadAuthorisedSession(channelId, userId);
    return prisma.sharedChatEntity.findMany({
      where: { channelId, revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  async revoke(id: string, userId: string) {
    const record = await prisma.sharedChatEntity.findUnique({ where: { id } });
    if (!record) {
      throw new ChatServiceError("Shared item not found", 404);
    }
    await loadAuthorisedSession(record.channelId, userId);
    if (record.revokedAt) {
      return record;
    }

    const updated = await prisma.sharedChatEntity.update({
      where: { id },
      data: { revokedAt: new Date(), revokedById: userId },
    });

    if (record.messageId) {
      try {
        await streamServer.deleteMessage(record.messageId, true);
      } catch (err) {
        logger.warn("Failed to delete Stream message for revoked share", err);
      }
    }

    return updated;
  },
};
