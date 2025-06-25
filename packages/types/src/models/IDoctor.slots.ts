import { Document } from 'mongoose';

export interface TimeSlot {
  time: string;
  time24: string;
  selected?: boolean;
}

export interface DoctorSlot {
  doctorId: string;
  day: string;
  timeSlots: TimeSlot[];
}

// If you want to use it with mongoose `Document`:
export interface DoctorSlotDocument extends DoctorSlot, Document {}
