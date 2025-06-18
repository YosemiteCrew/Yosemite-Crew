import { Types, Document } from 'mongoose'


export type medicalDoc = Document &{
  url?: string;
  originalname?: string;
  mimetype?: string;
}


export type medicalRecord = Document &{
  userId: string;
  documentType?: string;
  title?: string;
  issueDate?: string;
  hasExpiryDate?: string;
  petId?: string;
  expiryDate?: string;
  medicalDocs?: medicalDoc[];
}