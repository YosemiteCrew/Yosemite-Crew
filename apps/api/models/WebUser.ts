import  {  Schema, model } from 'mongoose';
import {IWebUser,IProfileData } from "@yosemite-crew/types";
/**
 * WebUser Interface & Schema
 */

const WebUserSchema = new Schema<IWebUser>({
  cognitoId: { type: String, required: true },
  role: { type: String, required: true },
  bussinessId: { type: String },
  otp: { type: Number },
  otpExpiry: { type: Date },
  subscribe:{type:Boolean,required:true}
});

const WebUser = model<IWebUser>('WebUser', WebUserSchema);

/**
 * ProfileData Interface & Schema
 */

const ProfileDataSchema = new Schema<IProfileData>({
  userId: { type: String },
  businessName: { type: String, required: true },
  registrationNumber: { type: String, required: true },
  // yearOfEstablishment: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  website: { type: String, required: true },
    addressLine1: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    latitude: { type: String, required: true },
    longitude: { type: String, required: true },

  departmentFeatureActive: { type: String },
  selectedServices: { type: [String], required: true },
  image: { type: String },
  addDepartment:{type:[String], required:true}
});

const ProfileData = model<IProfileData>('ProfileData', ProfileDataSchema);

export { WebUser, ProfileData };
