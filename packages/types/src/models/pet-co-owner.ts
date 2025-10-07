import { Document } from 'mongoose'
type  ProfileImage = Document & {
  url: string;
  originalname: string;
  mimetype: string;
}

export type PetCoOwner = Document & {
  _id?: string;
  firstName?: string;
  lastName?: string;
  relationToPetOwner?: string;
  createdBy?: string;
  profileImage?: ProfileImage[];
  createdAt?: Date;
  updatedAt?: Date;
}
