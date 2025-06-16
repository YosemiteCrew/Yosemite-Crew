import { Types, Document } from 'mongoose'

export type exercisePlanType = Document & {
  _id?: Types.ObjectId;
  planType?: string;
  planName?: string;
}