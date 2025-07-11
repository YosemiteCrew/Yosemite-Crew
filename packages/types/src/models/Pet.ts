import { Document } from 'mongoose'
interface PetImage {
  url: string;
  originalname: string;
  mimetype: string;
}

export interface IPet extends Document {
  cognitoUserId: string;
  petType?: string;
  petBreed?: string;
  petName?: string;
  petdateofBirth: Date;
  petGender?: string;
  petAge?: string;
  petCurrentWeight?: string;
  petColor?: string;
  petBloodGroup?: string;
  isNeutered?: string;
  ageWhenNeutered?: string;
  microChipNumber?: string;
  isInsured?: string;
  insuranceCompany?: string;
  policyNumber?: string;
  passportNumber?: string;
  petFrom?: string;
  petImage?: PetImage[];
}