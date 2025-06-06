import { Types, Document } from 'mongoose'

export type exerciseType = Document & {
  exerciseType: string;
}