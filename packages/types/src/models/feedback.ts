
import { Types, Document } from 'mongoose'

export interface IFeedback extends Document {
  userId?: Types.ObjectId;
  doctorId?: Types.ObjectId;
  petId?: Types.ObjectId;
  meetingId?: Types.ObjectId;
  feedback?: string;
  rating: number;
}