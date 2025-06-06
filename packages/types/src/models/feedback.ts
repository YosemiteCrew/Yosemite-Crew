
import { Types, Document } from 'mongoose'

export type feedback = Document & {
  userId?: string;
  doctorId?: string;
  petId?: string;
  meetingId?: string;
  feedback?: string;
  rating: number;
};