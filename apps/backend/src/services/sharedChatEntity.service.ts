// src/services/sharedChatEntity.service.ts
import { StreamChat } from "stream-chat";
import { Prisma, SharedChatEntityType } from "@prisma/client";
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

export const SharedChatEntityService = {
  async shareEntity(input: ShareEntityInput) {
    const { channelId, userId, entityType, entityId, title, snapshot } = input;
    const session = await loadAuthorisedSession(channelId, userId);

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
