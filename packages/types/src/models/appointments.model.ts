import { Document } from 'mongoose';

type DocumentFile = {
  url: string;
  originalname: string;
  mimetype: string;
};

export type WebAppointmentType = Document & {
  userId?: string;
  tokenNumber?: string;
  ownerName?: string;
  phone?: string;
  addressline1?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  petId?: string;
  petName?: string;
  petAge?: string;
  petType?: string;
  gender?: 'Male' | 'Female' | 'Other';
  breed?: string;
  purposeOfVisit: string;
  concernOfVisit?: string;
  appointmentType?: string;
  appointmentSource?: string;
  department: string;
  veterinarian: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentTime24: string;
  day: string;
  hospitalId?: string;
  slotsId: string;
  appointmentStatus?: string;
  isCanceled?: string;
  cancelledBy?: string;
  document?: DocumentFile[];
  createdAt?: Date;
  updatedAt?: Date;
};


export type AppointmentsTokenType = Document & {
  hospitalId: string;
  appointmentDate: string;
  tokenCounts: number;
  expireAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};
export type TimeSlot ={
  _id: string;
  time: string; // e.g., "15:30"
  time24: string; // e.g., "15:30"
}

export type NormalizedAppointment = {
  hospitalId: string;
  HospitalName: string;
  ownerName: string;
  phone: string;
  addressline1: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  petName: string;
  petAge: string;
  petType: string;
  gender: string;
  breed: string;
  purposeOfVisit: string;
  appointmentType: string;
  appointmentSource: string;
  department: string;
  veterinarian: string;
  appointmentDate: string; // e.g., "2025-06-04"
  day: string; // e.g., "Wednesday"
  timeSlots: TimeSlot[];
}