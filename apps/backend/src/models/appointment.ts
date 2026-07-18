// src/models/appointment.model.ts

export type AppointmentStatus =
  | "REQUESTED"
  | "UPCOMING"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export interface AppointmentMongo {
  companion: {
    id: string;
    name: string;
    species: string;
    breed?: string;
    parent: { id: string; name: string };
  };
  patient: AppointmentMongo["companion"];

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
  expiresAt?: Date;
}

export interface AppointmentDocument extends AppointmentMongo {
  _id: string;
}
