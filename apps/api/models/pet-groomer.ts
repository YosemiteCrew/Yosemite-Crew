import mongoose, { Schema, Model } from 'mongoose';
import type { PetGroomer } from '@yosemite-crew/types';

// Extend Document (not needed in Mongoose v7+ unless you want leaner control)

const petGroomerSchema: Schema<PetGroomer> = new mongoose.Schema({
  
    userId: {
      type: String,
      required: true,
    },
    groomerName: { type: String },
    groomerAddress: { type: String },
    city: { type: String },
    country: { type: String },
    zipCode: { type: String },
    telephone: { type: String },
    emailAddress: { type: String },
    website: { type: String },
  },
  { timestamps: true }
);

const PetGroomerModel: Model<PetGroomer> = mongoose.model<PetGroomer>('PetGroomer', petGroomerSchema);
export default PetGroomerModel;
