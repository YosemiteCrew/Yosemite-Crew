import { Document   } from 'mongoose';

export type painJournal =  Document & {
  userId: number;
  petId: number;
  typeOfAssessment?: string;
  answers?: any[]; 
}