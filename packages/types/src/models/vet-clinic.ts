import mongoose from "mongoose";

// @yosemite-crew/types
export interface IVetClinic {
  userId: string;
  clinicName?: string;
  vetName?: string;
  clinicAddress?: string;
  city?: string;
  country?: string;
  zipCode?: string;
  telephone?: string;
  emailAddess?: string;
  website?: string;
  createdAt?: Date;
  updatedAt?: Date;
  requestAccepted?:Boolean;
  petId?:mongoose.Types.ObjectId
}