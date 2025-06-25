import { Document } from 'mongoose'

// 1. Define the interface for TypeScript
export type IUser = Document & {
  cognitoId?: string;
  email?: string;
  password?: {
  encryptedData: string;
  iv: string;
  }[];
  otp?: number;
  otpExpiry?: Date;
  firstName: string;
  lastName?: string;
  mobilePhone?: string;
  countryCode?: string;
  city?: string;
  zipcode?: string;
  isProfessional?: string;
  isConfirmed?: boolean;
  professionType?: string[];
  pimsCode?: string;
  profileImage?: {
    url: string;
    originalname: string;
    mimetype: string;
  }[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SignupRequestBody {
  email: string;
  firstName: string;
  lastName: string;
  mobilePhone: string;
  countryCode: string;
  city: string;
  zipcode: string;
  professionType: string[] | string;
  pimsCode?: string;
  confirmationCode?:string;
  otp?:string;
  encryptedData?: string;
  iv?: string;
  token?:string;
}