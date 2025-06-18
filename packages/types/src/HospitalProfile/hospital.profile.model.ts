import {Document} from "mongoose";

export interface IProfileData extends Document {
  userId?: string;
  businessName?: string;
  registrationNumber?: string;
  yearOfEstablishment?: string;
  phoneNumber?: string;
  website?: string;
  address?: {
    addressLine1?: string;
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    latitude?: string;
    longitude?: string;
  };
  activeModes?: string;
  selectedServices?: string[];
  logo?: string;
  prescription_upload?: {
    name: string;
    type: string;
    date: Date;
  }[];
}
export interface IWebUser {
  cognitoId?: string;
  businessType?: string;
  bussinessId?: string;
  otp?: number;
  otpExpiry?: Date;
}
