import { Types, Document } from 'mongoose'


export interface ITimeSlot extends Document {
  time: string;
  time24: string;
  selected: boolean;
}

/**
 * 2. Interface for the doctor‐slot document.
 *    Extends Document so that fields like _id, save(), etc., are available.
 */
export interface IDoctorSlot extends Document {
  doctorId: Types.ObjectId;
  day: string;
  timeSlots: ITimeSlot[];
  createdAt: Date;
  updatedAt: Date;
}