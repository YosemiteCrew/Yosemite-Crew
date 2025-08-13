import mongoose, { Schema, Model } from 'mongoose';
import type { VaccinationDetailsType } from "@yosemite-crew/types";


const vaccinationSchema = new Schema<VaccinationDetailsType>({
  userId: { type: String, required: true },
  petId: { type: mongoose.Schema.Types.ObjectId, required: true , ref:'pets'},
  manufacturerName: String,
  vaccineName: String,
  batchNumber: String,
  expiryDate: Date,
  vaccinationDate: Date,
  hospitalName: String,
  nextdueDate: Date,
  reminder: { type: Boolean, default: false },
  vaccineImage: [
    {
      url: String,
      originalname: String,
      mimetype: String
    }
  ]
}, { timestamps: true });

const VaccinationDetails: Model<VaccinationDetailsType> =
  mongoose.model<VaccinationDetailsType>('VaccinationDetails', vaccinationSchema);

export default VaccinationDetails;
