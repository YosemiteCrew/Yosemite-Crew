import { Document, ObjectId   } from 'mongoose';

export type painJournal =  Document & {
  _id:ObjectId
  userId: number;
  petId: number;
  typeOfAssessment?: string;
  answers?: any[]; 
}