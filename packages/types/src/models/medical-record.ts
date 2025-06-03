import { Types, Document } from 'mongoose'


export interface IMedicalDoc extends Document {
  url?: string;
  originalname?: string;
  mimetype?: string;
}

/**
 * 2. Interface describing the raw fields of a medical record.
 */
export interface IMedicalRecord extends Document {
  userId: Types.ObjectId;
  documentType?: string;
  title?: string;
  issueDate?: string;
  expiryDate?: string;
  medicalDocs?: IMedicalDoc[];
}