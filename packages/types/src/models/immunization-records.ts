import { Types, Document } from 'mongoose'

export type VaccineImage = Document & {
  url: string;
  originalname: string;
  mimetype: string;
}

export type VaccinationDetailsType = Document & {
  _id?: string;
  userId: string;
  petId: Types.ObjectId;
  manufacturerName?: string;
  vaccineName?: string;
  batchNumber?: string;
  expiryDate?: Date;
  vaccinationDate?: Date;
  hospitalName?: string;
  nextdueDate?: Date;
  reminder?: boolean;
  vaccineImage?: VaccineImage[];
  createdAt?: Date;
  updatedAt?: Date;
}