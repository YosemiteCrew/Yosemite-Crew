import { Types, Document } from 'mongoose'

export type exercisePlanType = Document & {
  planType?: string;
  planName?: string;
}