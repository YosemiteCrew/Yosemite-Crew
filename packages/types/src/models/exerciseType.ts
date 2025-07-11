import { Types, Document } from 'mongoose'

export type exerciseType = Document & {
  _id?: Types.ObjectId | string;
  exerciseType: string;
}