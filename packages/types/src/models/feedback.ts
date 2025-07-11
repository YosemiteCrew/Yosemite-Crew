
import { Types, Document } from 'mongoose'

export type feedback = Document & {
  userId?: string;
  doctorId?: string;
  petId?: string;
  meetingId?: string;
  feedback?: string;
  rating: number;
};


export type feedbackData = {
  _id: Types.ObjectId;
  petId: string;
  doctorId: string;
  rating?: number;
  feedback?: string;
  createdAt?: string;
  meetingId: string;
  department?: string;
  doctorDetails?: {
    personalInfo?: {
      firstName?: string;
      lastName?: string;
      image?: string;
    };
    professionalBackground?: {
      qualification?: string;
    };
  };
};