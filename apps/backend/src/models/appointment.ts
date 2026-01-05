// src/models/appointment.model.ts
import mongoose, { Schema, HydratedDocument } from "mongoose";

export type AppointmentStatus =
  | "NO_PAYMENT"
  | "REQUESTED"
  | "UPCOMING"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface AppointmentMongo {
  companion: {
    id: string;
    name: string;
    species: string;
    breed?: string;
    parent: { id: string; name: string };
  };

  lead?: { id: string; name: string; profileUrl?: string };

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

  isEmergency?: boolean;
  concern?: string;

  attachments?: {
    key?: string;
    name?: string;
    contentType?: string;
  }[];

  formIds?: string[];

  createdAt?: Date;
  updatedAt?: Date;
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
      id: { type: String },
      name: { type: String },
      profileUrl: { type: String },
    },

    supportStaff: [
      {
        id: { type: String },
        name: { type: String },
      },
    ],

    room: {
      id: { type: String },
      name: { type: String },
    },

    appointmentType: {
      id: { type: String },
      name: { type: String },
      speciality: {
        id: { type: String },
        name: { type: String },
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
        "NO_PAYMENT",
      ],
      default: "NO_PAYMENT",
    },

    isEmergency: { type: Boolean, default: false },

    concern: { type: String },

    attachments: [
      {
        key: { type: String, required: true },
        name: { type: String },
        contentType: { type: String },
      },
    ],

    formIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Indices
AppointmentSchema.index({ organisationId: 1, appointmentDate: 1 });
AppointmentSchema.index({ "companion.id": 1, appointmentDate: -1 });
AppointmentSchema.index({ "supportStaff.id": 1 });
AppointmentSchema.index({ status: 1 });

AppointmentSchema.index(
  {
    organisationId: 1,
    "lead.id": 1,
    startTime: 1,
    endTime: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      "lead.id": { $exists: true, $ne: null },
      status: "UPCOMING",
    },
  },
);

export type AppointmentDocument = HydratedDocument<AppointmentMongo>;

const AppointmentModel = mongoose.model<AppointmentMongo>(
  "Appointment",
  AppointmentSchema,
);

export default AppointmentModel;
