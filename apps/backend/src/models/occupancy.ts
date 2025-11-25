import mongoose, { Schema, Document } from "mongoose";

export interface OccupancyMongo extends Document {
  userId: string;
  organisationId: string;
  startTime: Date;
  endTime: Date;
  sourceType: "APPOINTMENT" | "BLOCKED" | "SURGERY";
  referenceId?: string;
}

const OccupancySchema = new Schema<OccupancyMongo>(
  {
    userId: { type: String, required: true },
    organisationId: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    sourceType: {
      type: String,
      enum: ["APPOINTMENT", "BLOCKED", "SURGERY"],
      default: "APPOINTMENT",
    },
    referenceId: { type: String },
  },
  { timestamps: true },
);

OccupancySchema.index({ userId: 1, startTime: 1, endTime: 1 });

export type OccupancyDocument = mongoose.HydratedDocument<OccupancyMongo>;

export default mongoose.model<OccupancyMongo>("Occupancy", OccupancySchema);
