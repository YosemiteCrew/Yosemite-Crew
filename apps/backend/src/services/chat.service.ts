import { ChannelData, StreamChat } from "stream-chat";
import ChatSessionModel, { ChatSessionDocument } from "../models/chatSession";
import AppointmentModel from "../models/appointment";
import type { Appointment } from "@yosemite-crew/types";
import mongoose from "mongoose";
import logger from "../utils/logger";

const STREAM_KEY = process.env.STREAM_API_KEY!;
const STREAM_SECRET = process.env.STREAM_API_SECRET!;

if (!STREAM_KEY || !STREAM_SECRET) {
  throw new Error("Stream Chat credentials missing in env");
}

const streamServer = StreamChat.getInstance(STREAM_KEY, STREAM_SECRET);

export class ChatServiceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = "ChatServiceError";
  }
}


type YosemiteChannelData = ChannelData & {
  name?: string;
  appointmentId?: string;
  organisationId?: string;
  companionId?: string;
  parentId?: string;
  vetId?: string | null;
  status?: "active" | "ended";
};

export const ChatService = {

  async generateToken(userId: string) {
    if (!userId) throw new ChatServiceError("userId is required", 400);

    const token = streamServer.createToken(userId);

    return {
      token,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
  },

  async ensureSession(appointmentId: string): Promise<ChatSessionDocument> {
    const appointment = await AppointmentModel.findById(appointmentId);

    if (!appointment) throw new ChatServiceError("Appointment not found", 404);

    // Already created?
    let session = await ChatSessionModel.findOne({ appointmentId });
    if (session) return session;

    // Extract participants
    const parentId = appointment.companion.parent.id;
    const vetId = appointment.lead?.id;
    const orgId = appointment.organisationId;
    const companionId = appointment.companion.id;

    // PMS may not have assigned vet yet
    const members = [parentId];
    if (vetId) members.push(vetId);

    const channelId = `appointment-${appointmentId}`;

    const data : YosemiteChannelData = {
      name: `Chat with ${appointment.companion.parent.name || 'Pet Owner'}`,
      appointmentId,
      organisationId: orgId,
      companionId,
      parentId,
      vetId: vetId ?? null,
      status: "active",
      members,
    }

    // Create Stream channel
    const channel = streamServer.channel("messaging", channelId, data);

    await channel.create();

    // Create ChatSession in DB
    session = await ChatSessionModel.create({
      appointmentId,
      channelId,
      organisationId: orgId,
      companionId,
      parentId,
      vetId: vetId ?? null,
      members,
      status: "ACTIVE",
    });

    return session;
  },

  async closeSession(appointmentId: string) {
    const session = await ChatSessionModel.findOne({ appointmentId });
    if (!session) return;

    const channel = streamServer.channel("messaging", session.channelId);

    // System message
    await channel.sendMessage({
      user_id: "system",
      text: "This chat has been closed by the clinic.",
    });

    // Freeze channel
    await channel.update({ frozen: true, status: "ended" });

    // Update DB
    session.status = "CLOSED";
    await session.save();
  },


}