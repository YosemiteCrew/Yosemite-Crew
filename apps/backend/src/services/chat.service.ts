// src/services/chat.service.ts
import { ChannelData, StreamChat } from "stream-chat";
import dayjs from "dayjs";
import crypto from "node:crypto";

import ChatSessionModel, {
  ChatSessionDocument,
  ChatSessionType,
} from "../models/chatSession";
import AppointmentModel, { AppointmentDocument } from "../models/appointment";
import { UserProfileService } from "./user-profile.service";
import { UserService } from "./user.service";


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

const CHAT_ALLOWED_APPOINTMENT_STATUSES = [
  "UPCOMING",
  "IN_PROGRESS",
  "COMPLETED",
];

type YosemiteChannelData = ChannelData & {
  name?: string;
  appointmentId?: string;
  organisationId?: string;
  companionId?: string;
  parentId?: string;
  vetId?: string | null;
  status?: "active" | "ended";
  members?: string[];
  isPrivate?: boolean;
};

type YosemiteChannelResponse = ChannelData & {
  name?: string;
  isPrivate?: boolean;
}

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
  crypto
    .createHash("sha256")
    .update(input)
    .digest("hex")
    .slice(0, length);

const getStreamChannelType = (type: ChatSessionType) =>
  type === "APPOINTMENT" ? "messaging" : "team";

const getChatWindowFromAppointment = (appointment: AppointmentDocument) => {
  const start = dayjs(appointment.startTime);

  return {
    allowedFrom: start.subtract(PRE_WINDOW_MINUTES, "minute").toDate(),
    allowedUntil: start.add(POST_WINDOW_MINUTES, "minute").toDate(),
  };
};

const canUseChatNow = (
  session: ChatSessionDocument,
  appointment: AppointmentDocument,
) => {
  const now = new Date();

  if (session.status === "CLOSED") {
    return { allowed: false, reason: "Chat is closed." };
  }

  if (!CHAT_ALLOWED_APPOINTMENT_STATUSES.includes(appointment.status)) {
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

const assertUserCanAccess = (
  session: ChatSessionDocument,
  userId: string,
) => {
  if (session.status === "CLOSED") {
    throw new ChatServiceError("Chat is closed", 403);
  }

  if (!session.members.includes(userId)) {
    throw new ChatServiceError("User is not a member of this chat", 403);
  }
};

const assertGroupAdmin = (
  session: ChatSessionDocument,
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

  async ensureAppointmentChat(appointmentId: string): Promise<ChatSessionDocument> {
    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) throw new ChatServiceError("Appointment not found", 404);

    // Already created?
    let session = await ChatSessionModel.findOne({ appointmentId });
    if (session) return session;

    const parentId = appointment.companion.parent.id;
    //Upsert parent user in Stream
    await streamServer.upsertUser({
      id: parentId,
      name: appointment.companion.parent.name || "Pet Owner",
      role: "user",
    });

    const vetId = appointment.lead?.id ?? null;
    // Upsert vet user in Stream if assigned
    await streamServer.upsertUser({
      id: vetId!,
      name: appointment.lead?.name || "Vet",
      role: "user",
    });

    const orgId = appointment.organisationId;
    const companionId = appointment.companion.id;

    const members = [parentId];
    if (vetId) members.push(vetId);

    await streamServer.upsertUser({
      id: SYSTEM_USER_ID,
      name: "Yosemite System",
      role: "admin",
    });

    const channelId = `appointment-${appointmentId}`;

    const data: YosemiteChannelData = {
      name: `Chat with ${appointment.companion.name || "Companion"}`,
      appointmentId,
      organisationId: orgId,
      companionId,
      parentId,
      vetId,
      status: "active",
      members,
    };

    // IMPORTANT: include created_by_id (or created_by)
    const channel = streamServer.channel("messaging", channelId, {
      ...data,
      created_by_id: parentId,
    });

    await channel.create(); // no extra args needed here

    const { allowedFrom, allowedUntil } =
      getChatWindowFromAppointment(appointment);

    session = await ChatSessionModel.create({
      appointmentId,
      channelId,
      organisationId: orgId,
      companionId,
      parentId,
      vetId,
      members,
      allowedFrom,
      allowedUntil,
      status: "ACTIVE",
    });

    return session;
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
    
    const members = [userA, userB].sort();

    const existing = await ChatSessionModel.findOne({
      type: "ORG_DIRECT",
      organisationId,
      members: { $all: members, $size: 2 },
    });

    if (existing) return existing;

    // Upsert users in Stream
    for (const userId of members) {

      const userProfile = await UserProfileService.getByUserId(userId,organisationId);
      const user = await UserService.getById(userId);

      await streamServer.upsertUser({
        name: user?.firstName + " " + user?.lastName || "User",
        id: userId,
        image: userProfile?.profile.personalDetails?.profilePictureUrl || undefined,
        role: "user",
      });
    }

    const hash = shortHash(
      `${organisationId}:${members.join(":")}`,
    );

    const channelId = `od_${hash}`;

    await streamServer.channel("team", channelId, {
      members,
      created_by_id: userA,
    }).create();

    return ChatSessionModel.create({
      type: "ORG_DIRECT",
      organisationId,
      channelId,
      members,
      createdBy: userA,
      isPrivate: true,
      status: "ACTIVE",
    });
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
    const members = Array.from(
      new Set([...memberIds, createdBy]),
    );

    if (members.length < 2) {
      throw new ChatServiceError("Group chat needs at least 2 members");
    }


    // Upsert users in Stream
    for (const userId of members) {

      const userProfile = await UserProfileService.getByUserId(userId,organisationId);
      const user = await UserService.getById(userId);

      await streamServer.upsertUser({
        name: user?.firstName + " " + user?.lastName || "User",
        id: userId,
        image: userProfile?.profile.personalDetails?.profilePictureUrl || undefined,
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

    return ChatSessionModel.create({
      type: "ORG_GROUP",
      organisationId,
      channelId,
      title,
      members,
      createdBy,
      isPrivate,
      status: "ACTIVE",
    });
  },

  /* ------------------------------- OPEN CHAT ------------------------------ */

  async openChatBySessionId(
    sessionId: string,
    userId: string,
  ) {
    const session = await ChatSessionModel.findById(sessionId);
    if (!session) {
      throw new ChatServiceError("Chat session not found", 404);
    }

    assertUserCanAccess(session, userId);

    if (session.type === "APPOINTMENT") {
      const appointment = await AppointmentModel.findById(
        session.appointmentId,
      );
      if (!appointment) {
        throw new ChatServiceError("Appointment not found", 404);
      }

      const { allowed, reason } = canUseChatNow(session, appointment);
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

  async closeSession(sessionId: string) {
    const session = await ChatSessionModel.findById(sessionId);
    if (!session) return;

    const channel = streamServer.channel(
      getStreamChannelType(session.type),
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

    session.status = "CLOSED";
    session.closedAt = new Date();
    await session.save();
  },

  async addMembersToGroup(
    sessionId: string,
    actorUserId: string,
    memberIds: string[],
  ) {
    const session = await ChatSessionModel.findById(sessionId);
    if (!session) {
      throw new ChatServiceError("Chat session not found", 404);
    }

    assertGroupAdmin(session, actorUserId);

    const newMembers = memberIds.filter(
      (id) => !session.members.includes(id),
    );

    if (newMembers.length === 0) return session;


    // Upsert users in Stream
    for (const userId of newMembers) {

      const userProfile = await UserProfileService.getByUserId(userId,session.organisationId);
      const user = await UserService.getById(userId);

      await streamServer.upsertUser({
        name: user?.firstName + " " + user?.lastName || "User",
        id: userId,
        image: userProfile?.profile.personalDetails?.profilePictureUrl || undefined,
        role: "user",
      });
    }

    session.members.push(...newMembers);
    await session.save();

    const channel = streamServer.channel("team", session.channelId);
    await channel.addMembers(newMembers);

    return session;
  },

  async removeMembersFromGroup(
    sessionId: string,
    actorUserId: string,
    memberIds: string[],
  ) {
    const session = await ChatSessionModel.findById(sessionId);
    if (!session) {
      throw new ChatServiceError("Chat session not found", 404);
    }

    assertGroupAdmin(session, actorUserId);

    // prevent removing owner
    if (memberIds.includes(session.createdBy!)) {
      throw new ChatServiceError("Cannot remove group owner", 400);
    }

    session.members = session.members.filter(
      (id) => !memberIds.includes(id),
    );

    if (session.members.length < 2) {
      throw new ChatServiceError(
        "Group must have at least 2 members",
        400,
      );
    }

    await session.save();

    const channel = streamServer.channel("team", session.channelId);
    await channel.removeMembers(memberIds);

    return session;
  },

  async updateGroup(
    sessionId: string,
    actorUserId: string,
    updates: {
      title?: string;
      isPrivate?: boolean;
    },
  ) {
    const session = await ChatSessionModel.findById(sessionId);
    if (!session) {
      throw new ChatServiceError("Chat session not found", 404);
    }

    assertGroupAdmin(session, actorUserId);

    if (updates.title !== undefined) {
      session.title = updates.title;
    }

    if (updates.isPrivate !== undefined) {
      session.isPrivate = updates.isPrivate;
    }

    await session.save();

    const channel = streamServer.channel("team", session.channelId);

    const data: YosemiteChannelResponse = {
      name: updates.title,
      isPrivate: updates.isPrivate,
    };

    await channel.updatePartial({

    })

    await channel.updatePartial({
      set: {
        ...data,
      },
    });

    return session;
  },

  async deleteGroup(
    sessionId: string,
    actorUserId: string,
  ) {
    const session = await ChatSessionModel.findById(sessionId);
    if (!session) return;

    assertGroupAdmin(session, actorUserId);

    const channel = streamServer.channel("team", session.channelId);

    try {
      await channel.delete();
    } catch {
      // Stream failure should not block DB cleanup
    }

    await ChatSessionModel.deleteOne({ _id: sessionId });
  }
};