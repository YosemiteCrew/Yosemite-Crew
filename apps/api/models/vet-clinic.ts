import mongoose, { Schema, HydratedDocument } from 'mongoose';
import { IVetClinic } from '@yosemite-crew/types';

export type VetClinicDocument = HydratedDocument<IVetClinic>;

const vetClinicSchema = new Schema<IVetClinic>({
  userId: { type: String, required: true },
  clinicName: { type: String },
  vetName: { type: String },
  clinicAddress: { type: String },
  city: { type: String },
  country: { type: String },
  zipCode: { type: String },
  telephone: { type: String },
  emailAddess: { type: String },
  website: { type: String },
}, { timestamps: true });

const VetClinic = mongoose.model<IVetClinic>('VetClinic', vetClinicSchema);
export default VetClinic;