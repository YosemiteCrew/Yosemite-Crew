// src/models/appointment.model.ts
import mongoose, { Schema, Document, HydratedDocument } from "mongoose";

export type AppointmentStatus =
  | "REQUESTED"
  | "UPCOMING"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface AppointmentMongo extends Document {
  companion: {
    id: string;
    name: string;
    species: string;
    breed?: string;
    parent: { id: string; name: string };
  };
  lead: { id: string; name: string };
  supportStaff?: { id: string; name: string }[];
  room?: { id: string; name: string };
  appointmentType?: {
    id: string;
    name: string;
    speciality: { id: string; name: string };
  };
  organisationId: string;
  appointmentDate: Date;
  startTime: Date;
  endTime: Date;
  timeSlot: string;
  durationMinutes: number;
  status: AppointmentStatus;
  concern?: string;
  createdAt?: Date;
  updatedAt?: Date;
  meta?: {
    versionId?: string;
    lastUpdated?: Date;
  };
}

const AppointmentSchema = new Schema<AppointmentMongo>(
  {
    companion: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      species: { type: String, required: true },
      breed: { type: String },
      parent: {
        id: { type: String, required: true },
        name: { type: String, required: true },
      },
    },
    lead: {
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
    supportStaff: [{ id: String, name: String }],
    room: {
      id: String,
      name: String,
    },
    appointmentType: {
      id: String,
      name: String,
      speciality: {
        id: String,
        name: String,
      },
    },
    organisationId: { type: String, required: true },
    appointmentDate: { type: Date, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "REQUESTED",
        "UPCOMING",
        "CHECKED_IN",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "REQUESTED",
    },
    concern: String,
    meta: {
      versionId: { type: String, default: "1" },
      lastUpdated: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

AppointmentSchema.index({ organisationId: 1, startTime: 1, endTime: 1 });
AppointmentSchema.index({ "lead.id": 1 });
AppointmentSchema.index({ "companion.id": 1 });

export type AppointmentDocument = HydratedDocument<AppointmentMongo>;

const AppointmentModel = mongoose.model<AppointmentMongo>(
  "Appointment",
  AppointmentSchema
);
export default AppointmentModel;
