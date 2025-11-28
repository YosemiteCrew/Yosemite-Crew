// src/models/chat-session.model.ts

import { Schema, model, HydratedDocument } from "mongoose";

export interface ChatParticipant {
  userId: string;          // practitionerId, parentId, support staff id
  role: "parent" | "vet";
}

export interface ChatSessionMongo {
  appointmentId: string;
  organisationId: string;
  parentId: string;
  companionId: string;

  vetId?: string; // lead practitioner
  supportStaffIds?: string[];

  channelId: string; // Stream channel ID
  
  participants: ChatParticipant[];

  status: "ACTIVE" | "CLOSED";

  createdAt?: Date;
  updatedAt?: Date;
  closedAt?: Date | null;
}

const ChatParticipantSchema = new Schema<ChatParticipant>(
  {
    userId: { type: String, required: true },
    role: {
      type: String,
      enum: ["parent", "vet"],
      required: true,
    },
  },
  { _id: false }
);

const ChatSessionSchema = new Schema<ChatSessionMongo>(
  {
    appointmentId: { type: String, required: true, index: true, unique: true },
    organisationId: { type: String, required: true, index: true },
    parentId: { type: String, required: true },
    companionId: { type: String, required: true },

    vetId: { type: String },
    supportStaffIds: { type: [String], default: [] },

    channelId: { type: String, required: true },

    participants: { type: [ChatParticipantSchema], default: [] },

    status: {
      type: String,
      enum: ["ACTIVE", "CLOSED"],
      default: "ACTIVE",
    },

    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type ChatSessionDocument = HydratedDocument<ChatSessionMongo>;

const ChatSessionModel = model<ChatSessionMongo>(
  "ChatSession",
  ChatSessionSchema
);

export default ChatSessionModel;