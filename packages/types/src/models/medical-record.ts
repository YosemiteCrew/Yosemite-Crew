import mongoose, { Types, Document } from 'mongoose'



export type medicalDoc = Document &{
  url?: string;
  originalname?: string;
  mimetype?: string;
}


export type medicalRecord = Document &{
  userId: string;
  documentTypeId?: string; // Reference to MedicalRecordFolder
  title?: string;
  issueDate?: string;
  hasExpiryDate?: string;
  petId?: string;
  expiryDate?: string;
  medicalDocs?: medicalDoc[];
  isRead?: boolean;
  createdAt?: Date;
  petImage?:medicalDoc;
  createdByRole:string
}
export interface FHIRMedicalRecord {
  documentTypeId? : string,
  documentType?: string;
  title: string;
  issueDate?: string;
  expiryDate?: string;
  patientId: string;
  createdByRole:string;
}

export interface MedicalRecordRequestBody {
  data: string; // JSON string of FHIRMedicalRecord
  files?: string[]; // file URLs or metadata if needed
}
// Interface for attachments inside medicalDocs
 export interface MedicalDoc {
  url?: string;
  originalname?: string;
  mimetype?: string;
}
export interface MedicalRecord {
  _id?: mongoose.Types.ObjectId | string;
  id?: string;
  documentTypeId?: Types.ObjectId;
  title: string;
  issueDate: string;
  expiryDate?: string;
  userId: string;
  petId?: string;
  hasExpiryDate: boolean;
  medicalDocs?: MedicalDoc[];
}
