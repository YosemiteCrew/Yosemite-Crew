import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IDiscountCode extends Document {
  codeName: string;
  code: string;
  services: string[];
  couponType: 'Percentage' | 'Fixed amount';
  value: number;
  minOrderValue: number;
  validTill: Date | null;
  description: string;
  isActive: boolean;
  status: 'Paid' | 'Unpaid' | 'Partially Paid' | 'Overdue';
  createdOn: Date;
  usageCount: number;
}

const DiscountCodeSchema = new Schema<IDiscountCode>({
  codeName: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  services: { type: [String], default: [] },
  couponType: { type: String, enum: ['percentage', 'fixedAmount'], required: true },
  value: { type: Number, required: true },
  minOrderValue: { type: Number, required: true },
  validTill: { type: Date, default: null },
  description: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ['Paid', 'Unpaid', 'Partially Paid', 'Overdue'], default: 'Unpaid' },
  createdOn: { type: Date, default: Date.now },
  usageCount: { type: Number, default: 0 },
});

const DiscountCode: Model<IDiscountCode> = mongoose.models.DiscountCodeSchema || mongoose.model<IDiscountCode>('DiscountCode', DiscountCodeSchema);

export default DiscountCode;
