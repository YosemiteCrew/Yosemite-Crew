import mongoose, { Document, Schema } from "mongoose";
import {
  ISupportTicket, 
} from "@yosemite-crew/types";

// Counter schema for auto-increment ticketId
interface ICounter extends Document {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model<ICounter>("Counter", CounterSchema);

const SupportTicketSchema = new Schema<ISupportTicket & Document>(
  {
    ticketId: {
      type: String,
      unique: true,
    },
    category: {
      type: String,
      enum: ["General Enquiry", "Technical", "Billing", "Data Service Access Request", "Feature Request", "Complaint"],
      required: true,
    },
    platform: {
      type: String,
      enum: ["Email", "Discord", "Phone", "Web Form"],
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    emailAddress: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    userType: {
      type: String,
      enum: ["Registered", "Not Registered", "Guest"],
      required: true,
    },
    userStatus: {
      type: String,
      enum: ["Active", "Inactive", "Pending", "Suspended"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    attachments: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: [
        "New Ticket",
        "In Progress",
        "Waiting",
        "Escalated",
        "Reopened",
        "Closed",
      ], 
    },
    assignedTo: {
      type: String,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    createdBy: {
      type: String,
      enum: ["Admin", "User", "Guest", "Professional"],
      default: "User",
    },
    notes: [
      {
        type: String,
        trim: true,
      },
    ],
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// 🔑 Pre-save hook to generate sequential ticketId
SupportTicketSchema.pre<ISupportTicket & Document>(
  "save",
  async function (next) {
    if (this.isNew) {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "ticketId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      this.ticketId = `T${counter.seq}`;
    }
    next();
  }
);

// Index for better query performance
SupportTicketSchema.index({ ticketId: 1 });
SupportTicketSchema.index({ emailAddress: 1 });
SupportTicketSchema.index({ status: 1 });
SupportTicketSchema.index({ category: 1 });
SupportTicketSchema.index({ createdAt: -1 });

const SupportTicket = mongoose.model<ISupportTicket>(
  "SupportTicket",
  SupportTicketSchema
);

export default SupportTicket;
