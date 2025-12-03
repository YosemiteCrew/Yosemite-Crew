// src/services/chat.service.ts

import { ChannelData, StreamChat } from "stream-chat";
import dayjs from "dayjs";

import ChatSessionModel, {
  ChatSessionDocument,
} from "../models/chatSession";
import AppointmentModel, {
  AppointmentDocument,
} from "../models/appointment";

const STREAM_KEY = process.env.STREAM_API_KEY!;
const STREAM_SECRET = process.env.STREAM_API_SECRET!;

if (!STREAM_KEY || !STREAM_SECRET) {
  throw new Error("Stream Chat credentials missing in env");
}

const streamServer = StreamChat.getInstance(STREAM_KEY, STREAM_SECRET);

// How long before/after appointment chat is allowed
const PRE_WINDOW_MINUTES = 60;   // 1 hour before
const POST_WINDOW_MINUTES = 120; // 2 hours after

// Appointment statuses where chat is allowed
const CHAT_ALLOWED_APPOINTMENT_STATUSES: string[] = [
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

// Helper: derive allowedFrom / allowedUntil from appointment
const getChatWindowFromAppointment = (appointment: AppointmentDocument) => {
  const start = dayjs(appointment.startTime);

  const allowedFrom = start
    .subtract(PRE_WINDOW_MINUTES, "minute")
    .toDate();

  const allowedUntil = start
    .add(POST_WINDOW_MINUTES, "minute")
    .toDate();

  return { allowedFrom, allowedUntil };
};

// Helper: can this session be used right now?
const canUseChatNow = (
  session: ChatSessionDocument,
  appointment: AppointmentDocument,
): { allowed: boolean; reason?: string } => {
  const now = new Date();

  if (session.status === "CLOSED") {
    return { allowed: false, reason: "Chat is closed." };
  }

  if (!CHAT_ALLOWED_APPOINTMENT_STATUSES.includes(appointment.status)) {
    return {
      allowed: false,
      reason: "Chat is not available for this appointment status.",
    };
  }

  if (session.allowedFrom && now < session.allowedFrom) {
    return {
      allowed: false,
      reason: "Chat will be available closer to the appointment time.",
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

export const ChatService = {
  /**
   * Generate a Stream token for a user.
   * Used by mobile / PMS clients to connect to Stream.
   */
  generateToken(userId: string) {
    if (!userId) {
      throw new ChatServiceError("userId is required", 400);
    }

    const token = streamServer.createToken(userId);

    return {
      token,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
    };
  },

  /**
   * Ensure there is a chat session and channel for the given appointment.
   * If it already exists, returns it. If not, creates Mongo + Stream channel.
   */
  async ensureSession(appointmentId: string): Promise<ChatSessionDocument> {
    const appointment = await AppointmentModel.findById(appointmentId);

    if (!appointment) {
      throw new ChatServiceError("Appointment not found", 404);
    }

    // Already created?
    let session = await ChatSessionModel.findOne({ appointmentId });
    if (session) return session;

    // Extract participants
    const parentId = appointment.companion.parent.id;
    const vetId = appointment.lead?.id ?? null;
    const orgId = appointment.organisationId;
    const companionId = appointment.companion.id;

    const members: string[] = [parentId];
    if (vetId) members.push(vetId);

    const channelId = `appointment-${appointmentId}`;

    const { allowedFrom, allowedUntil } =
      getChatWindowFromAppointment(appointment);

    const data: YosemiteChannelData = {
      name: `Chat with ${appointment.companion.parent.name || "Pet Owner"}`,
      appointmentId,
      organisationId: orgId,
      companionId,
      parentId,
      vetId,
      status: "active",
      members,
    };

    // Create Stream channel
    const channel = streamServer.channel("messaging", channelId, data);
    await channel.create();

    // Create ChatSession in DB (start as PENDING)
    session = await ChatSessionModel.create({
      appointmentId,
      channelId,
      organisationId: orgId,
      companionId,
      parentId,
      vetId,
      members,
      status: "PENDING",
      allowedFrom,
      allowedUntil,
    });

    return session;
  },

  /**
   * "Open" chat for a user:
   *  - ensures session exists
   *  - checks appointment status + chat window
   *  - activates session if needed
   *  - returns channelId + Stream token
   */
  async openChat(appointmentId: string, userId: string) {
    if (!userId) {
      throw new ChatServiceError("userId is required", 400);
    }

    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) {
      throw new ChatServiceError("Appointment not found", 404);
    }

    // Ensure we have a session and channel
    const session = await this.ensureSession(appointmentId);

    // Check window + status
    const { allowed, reason } = canUseChatNow(session, appointment);
    if (!allowed) {
      throw new ChatServiceError(reason ?? "Chat not available", 403);
    }

    // If still pending, activate it
    if (session.status === "PENDING") {
      session.status = "ACTIVE";
      await session.save();

      const channel = streamServer.channel(
        "messaging",
        session.channelId,
      );

      await channel.updatePartial({
        set: { frozen: false },
      });

      await channel.sendMessage({
        user_id: "system",
        text: "Chat has been activated.",
      });
    }

    const { token, expiresAt } = this.generateToken(userId);

    return {
      channelId: session.channelId,
      token,
      expiresAt,
    };
  },

  /**
   * Close chat for an appointment (typically from PMS / vet side).
   */
  async closeSession(appointmentId: string) {
    const session = await ChatSessionModel.findOne({ appointmentId });
    if (!session) return;

    const channel = streamServer.channel("messaging", session.channelId);

    try {
      await channel.sendMessage({
        user_id: "system",
        text: "This chat has been closed by the clinic.",
      });

      await channel.updatePartial({
        set: { frozen: true },
      });
    } catch {
      // log if you want, but still close in DB
      // logger.error("Failed to freeze Stream channel", err);
    }

    session.status = "CLOSED";
    await session.save();
  },

  /**
   * Optional helper if, later, you need to add a vet mid-way
   * when appointment is approved and lead gets assigned.
   */
  async addVetToSession(appointmentId: string, vetId: string) {
    const session = await ChatSessionModel.findOne({ appointmentId });
    if (!session) {
      throw new ChatServiceError("Chat session not found", 404);
    }

    if (!session.members.includes(vetId)) {
      session.members.push(vetId);
      session.vetId = vetId;
      await session.save();

      const channel = streamServer.channel("messaging", session.channelId);
      await channel.addMembers([vetId]);
    }
  },
};
