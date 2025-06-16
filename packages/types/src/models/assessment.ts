
import { Types, Document } from 'mongoose'

export type assessment =  Document & {
  userId: Types.ObjectId;
  hospitalId: Types.ObjectId;
  assessmentId: Types.ObjectId;
  petId: Types.ObjectId;
  doctorId?: Types.ObjectId;
  assessmentType?: string;
  type?: string;
  questions?: any[]; // You can create a more specific type if the structure is known
  score?: number;
  assessmentStatus?: string;
}
