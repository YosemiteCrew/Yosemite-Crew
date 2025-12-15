import { Schema, model } from "mongoose";

export interface DeviceTokenMongo {
  userId: string; // parentId OR pmsUserId
  deviceToken: string;
  platform: "ios" | "android";
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const DeviceTokenSchema = new Schema<DeviceTokenMongo>(
  {
    userId: { type: String, required: true, index: true },
    deviceToken: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["ios", "android"], required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const DeviceTokenModel = model<DeviceTokenMongo>(
  "DeviceToken",
  DeviceTokenSchema,
);
