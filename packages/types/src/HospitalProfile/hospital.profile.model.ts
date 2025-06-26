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
    latitude?: string;
    longitude?: string;

  departmentFeatureActive?: string;
  selectedServices?: string[];
  image?: string;
  addDepartment:string[];
}
export interface IWebUser {
  cognitoId?: string;
  role?: string;
  bussinessId?: string;
  otp?: number;
  otpExpiry?: Date;
  subscribe?:boolean
}
