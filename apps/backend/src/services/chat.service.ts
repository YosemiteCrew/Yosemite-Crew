// src/services/chat.service.ts
import { ChannelData, StreamChat } from "stream-chat";
import dayjs from "dayjs";
import crypto from "node:crypto";

import { ChatSessionDocument, ChatSessionType } from "../models/chatSession";
import { AppointmentDocument } from "../models/appointment";
import { UserProfileService } from "./user-profile.service";
import { UserService } from "./user.service";
import { prisma } from "src/config/prisma";

const STREAM_KEY = process.env.STREAM_API_KEY!;
const STREAM_SECRET = process.env.STREAM_API_SECRET!;
const SYSTEM_USER_ID = "system-yosemite";

if (!STREAM_KEY || !STREAM_SECRET) {
  throw new Error("Stream Chat credentials missing in env");
}

const streamServer = StreamChat.getInstance(STREAM_KEY, STREAM_SECRET);

// Appointment chat window
const PRE_WINDOW_MINUTES = 60 * 24;
const POST_WINDOW_MINUTES = 120;

const CHAT_ALLOWED_APPOINTMENT_STATUSES = new Set([
  "UPCOMING",
  "IN_PROGRESS",
  "COMPLETED",
]);

type YosemiteChannelData = ChannelData & {
  name?: string;
  appointmentId?: string;
  organisationId?: string;
  patientId?: string;
  parentId?: string;
  vetId?: string | null;
  status?: "active" | "ended";
  members?: string[];
  isPrivate?: boolean;
};

type YosemiteChannelResponse = ChannelData & {
  name?: string;
  isPrivate?: boolean;
};

export class ChatServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "ChatServiceError";
  }
}

const shortHash = (input: string, length = 12) =>
  crypto.createHash("sha256").update(input).digest("hex").slice(0, length);

const getStreamChannelType = (type: ChatSessionType) =>
  type === "APPOINTMENT" ? "messaging" : "team";

const getChatWindowFromAppointment = (appointment: AppointmentDocument) => {
  const start = dayjs(appointment.startTime);

  return {
    allowedFrom: start.subtract(PRE_WINDOW_MINUTES, "minute").toDate(),
    allowedUntil: start.add(POST_WINDOW_MINUTES, "minute").toDate(),
  };
};

type ChatAvailability =
  { allowed: true; reason?: undefined } | { allowed: false; reason: string };

const canUseChatNowCore = (
  session: {
    status: string;
    allowedFrom?: Date | null;
    allowedUntil?: Date | null;
  },
  appointment: { status: string },
): ChatAvailability => {
  const now = new Date();

  if (session.status === "CLOSED") {
    return { allowed: false, reason: "Chat is closed." };
  }

  if (!CHAT_ALLOWED_APPOINTMENT_STATUSES.has(appointment.status)) {
    return {
      allowed: false,
      reason: "Chat not available for this appointment status.",
    };
  }

  if (session.allowedFrom && now < session.allowedFrom) {
    return {
      allowed: false,
      reason: "Chat will be available closer to appointment time.",
    };
  }

  if (session.allowedUntil && now > session.allowedUntil) {
    return {
      allowed: false,
      reason: "Chat window has ended.",
    };
  }

  return { allowed: true };
};

const assertUserCanAccessCore = (
  session: { status: string; members: string[] },
  userId: string,
) => {
  if (session.status === "CLOSED") {
    throw new ChatServiceError("Chat is closed", 403);
  }

  if (!session.members.includes(userId)) {
    throw new ChatServiceError("User is not a member of this chat", 403);
  }
};

const assertUserCanAccessPrisma = (
  session: { status: string; members: string[] },
  userId: string,
) => assertUserCanAccessCore(session, userId);

const assertGroupAdminCore = (
  session: { type: string; createdBy: string | null; status: string },
  userId: string,
) => {
  if (session.type !== "ORG_GROUP") {
    throw new ChatServiceError("Not a group chat", 400);
  }

  if (session.createdBy !== userId) {
    throw new ChatServiceError("Only group owner can perform this action", 403);
  }

  if (session.status === "CLOSED") {
    throw new ChatServiceError("Chat is closed", 400);
  }
};

const assertGroupAdminPrisma = (
  session: { type: string; createdBy: string | null; status: string },
  userId: string,
): void => assertGroupAdminCore(session, userId);

const isUserInOrg = async (
  userId: string,
  organisationId: string,
): Promise<boolean> => {
  const mapping = await prisma.userOrganization.findFirst({
    where: {
      practitionerReference: userId,
      OR: [
        { organizationReference: organisationId },
        { organizationReference: `Organization/${organisationId}` },
      ],
    },
  });
  return Boolean(mapping);
};

/**
 * Assert every supplied user is associated with the organisation. Stops a member
 * of one clinic from creating chats under another org, or pulling users who do
 * not belong to the org into a channel. Mirrors the rbac membership probe.
 */
const assertUsersInOrg = async (
  userIds: string[],
  organisationId: string,
): Promise<void> => {
  for (const userId of userIds) {
    const ok = await isUserInOrg(userId, organisationId);
    if (!ok) {
      throw new ChatServiceError(
        "User is not associated with this organisation",
        403,
      );
    }
  }
};

const assertCanCloseSession = (
  session: { type: string; createdBy?: string | null; members: string[] },
  userId: string,
) => {
  if (session.type === "ORG_GROUP") {
    if (session.createdBy !== userId) {
      throw new ChatServiceError(
        "Only the group owner can close this chat",
        403,
      );
    }
    return;
  }
  if (!session.members.includes(userId)) {
    throw new ChatServiceError("User is not a member of this chat", 403);
  }
};

export const ChatService = {
  /* ------------------------------ AUTH ----------------------------------- */

  generateToken(userId: string) {
    if (!userId) throw new ChatServiceError("userId is required");

    return {
      token: streamServer.createToken(userId),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
  },

  async initSystemUserOnce() {
    await streamServer.upsertUser({
      id: SYSTEM_USER_ID,
      name: "Yosemite System",
      role: "admin",
    });
  },

  /* -------------------------- APPOINTMENT CHAT --------------------------- */

  async ensureAppointmentChat(
    appointmentId: string,
  ): Promise<ChatSessionDocument> {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new ChatServiceError("Appointment not found", 404);
    }

    const existing = await prisma.chatSession.findFirst({
      where: { appointmentId },
    });
    if (existing) {
      return {
        ...existing,
        _id: existing.id,
      } as unknown as ChatSessionDocument;
    }

    const companion = appointment.patient as {
      id: string;
      parent?: { id: string; name?: string };
    };
    const parentId = companion?.parent?.id;
    if (!parentId) {
      throw new ChatServiceError("Parent not found in appointment", 404);
    }

    await streamServer.upsertUser({
      id: parentId,
      name: companion?.parent?.name || "Pet Owner",
      role: "user",
    });

    const lead = appointment.lead as { id?: string; name?: string } | null;
    const vetId = lead?.id ?? null;
    if (vetId) {
      await streamServer.upsertUser({
        id: vetId,
        name: lead?.name || "Vet",
        role: "user",
      });
    }

    const orgId = appointment.organisationId;
    const patientId = companion?.id ?? undefined;

    const members = [parentId];
    if (vetId) members.push(vetId);

    await streamServer.upsertUser({
      id: SYSTEM_USER_ID,
      name: "Yosemite System",
      role: "admin",
    });

    const channelId = `appointment-${appointmentId}`;

    const { allowedFrom, allowedUntil } = getChatWindowFromAppointment({
      startTime: appointment.startTime,
    } as AppointmentDocument);

    const channelData: YosemiteChannelData = {
      name: `Appointment Chat`,
      appointmentId,
      organisationId: orgId,
      patientId,
      parentId,
      vetId,
      status: "active",
      members,
    };

    await streamServer.channel("messaging", channelId, channelData).create();

    const session = await prisma.chatSession.create({
      data: {
        type: "APPOINTMENT",
        appointmentId,
        channelId,
        organisationId: orgId,
        patientId: patientId ?? undefined,
        parentId,
        vetId: vetId ?? undefined,
        members,
        status: "ACTIVE",
        allowedFrom,
        allowedUntil,
        isPrivate: true,
      },
    });

    return { ...session, _id: session.id } as unknown as ChatSessionDocument;
  },

  /* ---------------------------- ORG DIRECT CHAT --------------------------- */

  async createOrgDirectChat(
    organisationId: string,
    userA: string,
    userB: string,
  ): Promise<ChatSessionDocument> {
    if (userA === userB) {
      throw new ChatServiceError("Cannot chat with yourself");
    }

    const members = [userA, userB].sort((a, b) => a.localeCompare(b));

    await assertUsersInOrg(members, organisationId);

    const existing = await prisma.chatSession.findFirst({
      where: {
        type: "ORG_DIRECT",
        organisationId,
        members: { equals: members },
      },
    });

    if (existing)
      return {
        ...existing,
        _id: existing.id,
      } as unknown as ChatSessionDocument;

    // Upsert users in Stream
    for (const userId of members) {
      const userProfile = await UserProfileService.getByUserId(
        userId,
        organisationId,
      );
      const user = await UserService.getById(userId);

      await streamServer.upsertUser({
        name: user?.firstName + " " + user?.lastName || "User",
        id: userId,
        image:
          userProfile?.profile.personalDetails?.profilePictureUrl || undefined,
        role: "user",
      });
    }

    const hash = shortHash(`${organisationId}:${members.join(":")}`);

    const channelId = `od_${hash}`;

    await streamServer
      .channel("team", channelId, {
        members,
        created_by_id: userA,
      })
      .create();

    const session = await prisma.chatSession.create({
      data: {
        type: "ORG_DIRECT",
        organisationId,
        channelId,
        members,
        createdBy: userA,
        isPrivate: true,
        status: "ACTIVE",
      },
    });
    return { ...session, _id: session.id } as unknown as ChatSessionDocument;
  },

  /* ----------------------------- ORG GROUP CHAT --------------------------- */

  async createOrgGroupChat({
    organisationId,
    createdBy,
    title,
    memberIds,
    isPrivate = true,
  }: {
    organisationId: string;
    createdBy: string;
    title: string;
    memberIds: string[];
    isPrivate?: boolean;
  }): Promise<ChatSessionDocument> {
    const members = Array.from(new Set([...memberIds, createdBy]));

    if (members.length < 2) {
      throw new ChatServiceError("Group chat needs at least 2 members");
    }

    await assertUsersInOrg(members, organisationId);

    // Upsert users in Stream
    for (const userId of members) {
      const userProfile = await UserProfileService.getByUserId(
        userId,
        organisationId,
      );
      const user = await UserService.getById(userId);

      await streamServer.upsertUser({
        name: user?.firstName + " " + user?.lastName || "User",
        id: userId,
        image:
          userProfile?.profile.personalDetails?.profilePictureUrl || undefined,
        role: "user",
      });
    }

    const channelId = `org-group-${Date.now()}`;

    const channelData: YosemiteChannelData = {
      name: title,
      isPrivate,
      members,
      created_by_id: createdBy,
    };

    await streamServer.channel("team", channelId, channelData).create();

    const session = await prisma.chatSession.create({
      data: {
        type: "ORG_GROUP",
        organisationId,
        channelId,
        title,
        members,
        createdBy,
        isPrivate,
        status: "ACTIVE",
      },
    });
    return { ...session, _id: session.id } as unknown as ChatSessionDocument;
  },

  /* ------------------------------- OPEN CHAT ------------------------------ */

  async openChatBySessionId(sessionId: string, userId: string) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId },
    });
    if (!session) {
      throw new ChatServiceError("Chat session not found", 404);
    }

    assertUserCanAccessPrisma(session, userId);

    if (session.type === "APPOINTMENT") {
      const appointment = await prisma.appointment.findFirst({
        where: { id: session.appointmentId ?? undefined },
      });
      if (!appointment) {
        throw new ChatServiceError("Appointment not found", 404);
      }

      const { allowed, reason } = canUseChatNowCore(session, appointment);
      if (!allowed) {
        throw new ChatServiceError(reason ?? "Chat not available", 403);
      }
    }

    const { token, expiresAt } = this.generateToken(userId);

    return {
      channelId: session.channelId,
      token,
      expiresAt,
    };
  },

  /* ------------------------------- CLOSE CHAT ----------------------------- */

  async closeSession(sessionId: string, actorUserId: string) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId },
    });
    if (!session) return;

    assertCanCloseSession(session, actorUserId);

    const channel = streamServer.channel(
      getStreamChannelType(session.type as ChatSessionType),
      session.channelId,
    );

    try {
      await channel.sendMessage({
        user_id: SYSTEM_USER_ID,
        text: "This chat has been closed.",
      });

      await channel.updatePartial({ set: { frozen: true } });
    } catch {
      // swallow errors, DB is source of truth
    }

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  },

  async addMembersToGroup(
    sessionId: string,
    actorUserId: string,
    memberIds: string[],
  ) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId },
    });
    if (!session) {
      throw new ChatServiceError("Chat session not found", 404);
    }

    assertGroupAdminPrisma(session, actorUserId);

    const newMembers = memberIds.filter((id) => !session.members.includes(id));

    if (newMembers.length === 0)
      return { ...session, _id: session.id } as unknown as ChatSessionDocument;

    await assertUsersInOrg(newMembers, session.organisationId);

    // Upsert users in Stream
    for (const userId of newMembers) {
      const userProfile = await UserProfileService.getByUserId(
        userId,
        session.organisationId,
      );
      const user = await UserService.getById(userId);

      await streamServer.upsertUser({
        name: user?.firstName + " " + user?.lastName || "User",
        id: userId,
        image:
          userProfile?.profile.personalDetails?.profilePictureUrl || undefined,
        role: "user",
      });
    }

    const updatedMembers = [...session.members, ...newMembers];
    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { members: updatedMembers },
    });

    const channel = streamServer.channel("team", session.channelId);
    await channel.addMembers(newMembers);

    return { ...updated, _id: updated.id } as unknown as ChatSessionDocument;
  },

  async removeMembersFromGroup(
    sessionId: string,
    actorUserId: string,
    memberIds: string[],
  ) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId },
    });
    if (!session) {
      throw new ChatServiceError("Chat session not found", 404);
    }

    assertGroupAdminPrisma(session, actorUserId);

    // prevent removing owner
    if (memberIds.includes(session.createdBy ?? "")) {
      throw new ChatServiceError("Cannot remove group owner", 400);
    }

    const nextMembers = session.members.filter((id) => !memberIds.includes(id));

    if (nextMembers.length < 2) {
      throw new ChatServiceError("Group must have at least 2 members", 400);
    }

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { members: nextMembers },
    });

    const channel = streamServer.channel("team", session.channelId);
    await channel.removeMembers(memberIds);

    return { ...updated, _id: updated.id } as unknown as ChatSessionDocument;
  },

  async updateGroup(
    sessionId: string,
    actorUserId: string,
    updates: {
      title?: string;
      isPrivate?: boolean;
    },
  ) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId },
    });
    if (!session) {
      throw new ChatServiceError("Chat session not found", 404);
    }

    assertGroupAdminPrisma(session, actorUserId);

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        title: updates.title ?? session.title ?? undefined,
        isPrivate: updates.isPrivate ?? session.isPrivate,
      },
    });

    const channel = streamServer.channel("team", session.channelId);

    const data: YosemiteChannelResponse = {
      name: updates.title,
      isPrivate: updates.isPrivate,
    };

    await channel.updatePartial({ set: data });
    return { ...updated, _id: updated.id } as unknown as ChatSessionDocument;
  },

  async deleteGroup(sessionId: string, actorUserId: string) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId },
    });
    if (!session) return;

    assertGroupAdminPrisma(session, actorUserId);

    const channel = streamServer.channel("team", session.channelId);

    try {
      await channel.delete();
    } catch {
      // Stream failure should not block DB cleanup
    }

    await prisma.chatSession.deleteMany({ where: { id: sessionId } });
  },
};
