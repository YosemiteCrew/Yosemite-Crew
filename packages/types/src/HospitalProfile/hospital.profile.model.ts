import {Document} from "mongoose";

export interface IProfileData extends Document {
  userId?: string;
  businessName?: string;
  registrationNumber?: string;
  yearOfEstablishment?: string;
  phoneNumber?: string;
  website?: string;

    addressLine1?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    area?: string;
    latitude?: string;
    longitude?: string;
    country?: string;

  departmentFeatureActive?: string;
  selectedServices?: string[];
  image?: string;
  addDepartment:string[];
  prescription_upload?: { name: string; url: string; }[];
  key?:string,
  progress?:number
}
export interface IWebUser {
  cognitoId?: string;
  role?: string;
  bussinessId?: string;
  otp?: number;
  otpExpiry?: Date;
  subscribe?:boolean;
  department?:string
  lastLogin?: Date;
  isVerified?:number
}
