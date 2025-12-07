import { Schema, model, HydratedDocument } from "mongoose";

export interface ChatParticipant {
  userId: string; // practitionerId, parentId, support staff id
  role: "parent" | "vet" | "support";
}

export type ChatSessionStatus = "PENDING" | "ACTIVE" | "CLOSED";

export interface ChatSessionMongo {
  appointmentId: string;
  channelId: string;

  organisationId: string;
  companionId: string;
  parentId: string;
  vetId: string | null;
  supportStaffIds: string[];

  /**
   * Flat list of all userIds in this chat.
   * This is what we send to Stream as `members`.
   */
  members: string[];

  /**
   * Optional richer structure if you want roles per participant.
   * Not required for Stream, but useful on PMS/mobile side.
   */
  participants: ChatParticipant[];

  status: ChatSessionStatus;

  // Configured window during which chat is allowed
  allowedFrom?: Date;
  allowedUntil?: Date;

  closedAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

const ChatParticipantSchema = new Schema<ChatParticipant>(
  {
    userId: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["parent", "vet", "support"],
      required: true,
    },
  },
  { _id: false },
);

const ChatSessionSchema = new Schema<ChatSessionMongo>(
  {
    appointmentId: {
      type: String,
      required: true,
      index: true,
      unique: true, // one chat per appointment
      trim: true,
    },
    organisationId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    companionId: {
      type: String,
      required: true,
      trim: true,
    },
    parentId: {
      type: String,
      required: true,
      trim: true,
    },

    vetId: { type: String, default: null },
    supportStaffIds: { type: [String], default: [] },

    channelId: {
      type: String,
      required: true,
      trim: true,
    },

    // Flat member ids used with Stream
    members: {
      type: [String],
      default: [],
    },

    // Optional richer participant info
    participants: {
      type: [ChatParticipantSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "CLOSED"],
      default: "PENDING",
      index: true,
    },

    allowedFrom: { type: Date },
    allowedUntil: { type: Date },

    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Helpful indexes
ChatSessionSchema.index({ organisationId: 1, status: 1 });
ChatSessionSchema.index({ parentId: 1 });
ChatSessionSchema.index({ vetId: 1 });

export type ChatSessionDocument = HydratedDocument<ChatSessionMongo>;

const ChatSessionModel = model<ChatSessionMongo>(
  "ChatSession",
  ChatSessionSchema,
);

export default ChatSessionModel;