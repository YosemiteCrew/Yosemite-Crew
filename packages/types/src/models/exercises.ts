import { Types, Document } from 'mongoose'
export type exercises = Document & {
  planId?: string; // or mongoose.Types.ObjectId if referencing
  planType?: string;
  planName?: string;
  exerciseType?: string;
  exerciseTitle?: string;
  exerciseSubTitle?: string;
  exerciseThumbnail?: string;
  exerciseVideo?: string;
  exerciseDescription?: string;
}