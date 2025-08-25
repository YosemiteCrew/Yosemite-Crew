// models/petBoarding.model.ts

import  mongoose,{ Schema, Model } from 'mongoose';
import type { PetBoarding } from '@yosemite-crew/types'; // adjust path if local


const PetBoardingSchema: Schema<PetBoarding> = new mongoose.Schema({
    userId: {  },
    boardingName: { type: String },
    boardingAddress: { type: String },
    city: { type: String },
    country: { type: String },
    zipCode: { type: String },
    telephone: { type: String },
    emailAddess: { type: String },
    website: { type: String },
    petId:{type:Schema.Types.ObjectId,ref: "pets",}
  },
  { timestamps: true }
);

// Strongly typed model

const PetBoardingModel: Model<PetBoarding> = mongoose.model<PetBoarding>('PetBoardingDetails', PetBoardingSchema);
export default PetBoardingModel;

