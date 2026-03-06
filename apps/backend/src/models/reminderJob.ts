// models/reminderJob.ts

import { Schema, model, HydratedDocument } from "mongoose";

export interface ReminderJobMongo {
  taskId: string;
  userId: string;
  scheduledFor: Date;
  timezone?: string;

  status: "SCHEDULED" | "SENT" | "CANCELLED";
  jobKey?: string; // used by BullMQ or cron scheduler
}

const ReminderJobSchema = new Schema<ReminderJobMongo>(
  {
    taskId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    scheduledFor: { type: Date, required: true },
    timezone: { type: String },

    status: {
      type: String,
      enum: ["SCHEDULED", "SENT", "CANCELLED"],
      default: "SCHEDULED",
    },

    jobKey: { type: String },
  },
  { timestamps: true },
);

export type ReminderJobDocument = HydratedDocument<ReminderJobMongo>;
export default model<ReminderJobMongo>("ReminderJob", ReminderJobSchema);
