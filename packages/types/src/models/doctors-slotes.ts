import { Types, Document } from 'mongoose'


export type timeSlot = Document & {
  time: string;
  time24: string;
  selected: boolean;
}

/**
 * 2. Interface for the doctor‐slot document.
 *    Extends Document so that fields like _id, save(), etc., are available.
 */
export type doctorSlot = Document & {
  doctorId: Types.ObjectId;
  day: string;
  timeSlots: timeSlot[];
  createdAt: Date;
  updatedAt: Date;
}