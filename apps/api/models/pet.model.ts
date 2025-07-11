import mongoose, { Schema, Model } from "mongoose";
import type { IPet } from "@yosemite-crew/types";



const PetSchema: Schema<IPet> = new mongoose.Schema(
  {
    cognitoUserId: { type: String, required: true },
    petType: { type: String },
    petBreed: { type: String },
    petName: { type: String },
    petdateofBirth: { type: Date },
    petGender: { type: String },
    petAge: { type: String },
    petCurrentWeight: { type: String },
    petColor: { type: String },
    petBloodGroup: { type: String },
    isNeutered: { type: String },
    ageWhenNeutered: { type: String },
    microChipNumber: { type: String },
    isInsured: { type: String },
    insuranceCompany: { type: String },
    policyNumber: { type: String },
    passportNumber: { type: String },
    petFrom: { type: String },
    petImage: [
      {
        url: { type: String },
        originalname: { type: String },
        mimetype: { type: String },
      },
    ],
  },
  { timestamps: true }
);

const pets: Model<IPet> = mongoose.model<IPet>(
  "pets",
  PetSchema
);

export default pets;
