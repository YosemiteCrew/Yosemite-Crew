import { Schema, model, HydratedDocument } from "mongoose";

export type NotificationType =
  | "CHAT_MESSAGE"
  | "APPOINTMENTS"
  | "REMINDERS"
  | "PROMOTIONS"
  | "PAYMENTS";

export interface NotificationMongo {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  enabled: boolean;
  isSeen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<NotificationMongo>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ["CHAT_MESSAGE", "APPOINTMENTS", "REMINDERS", "PROMOTIONS"],
      required: true,
    },
    enabled: { type: Boolean, default: true },
    isSeen: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const NotificationModel = model<NotificationMongo>(
  "Notification",
  NotificationSchema,
);

export type NotificationDocument = HydratedDocument<NotificationMongo>;
