import  { Types } from "mongoose";

// types/PetBoarding.ts (or in @yosemite-crew/types if you have a monorepo)
export interface PetBoarding {
  _id?: string;
  userId: string;
  boardingName?: string;
  boardingAddress?: string;
  city?: string;
  country?: string;
  zipCode?: string;
  telephone?: string;
  emailAddess?: string;
  website?: string;
  createdAt?: Date;
  updatedAt?: Date;
  petId?:Types.ObjectId
}
