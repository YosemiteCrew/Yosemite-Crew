import { Types, Document } from 'mongoose'
export type exercises = Document & {
  _id?:Types.ObjectId;
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


export type queryParams = {
  type?: string;
  keyword?: string;
  page?: number;
  total?: number;
  limit?: number;
  sort?: "asc" | "desc";
}
