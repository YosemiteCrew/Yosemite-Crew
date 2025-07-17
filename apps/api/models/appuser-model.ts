import { Schema, model, models, Model } from 'mongoose';
import type { IUser } from '@yosemite-crew/types';

const userSchema = new Schema<IUser>(
  {
    cognitoId: { type: String },
    email: { type: String },
    password: [
      {
        encryptedData: { type: String },
        iv: { type: String },
      },
    ],
    otp: { type: Number },
    otpExpiry: { type: Date },
    firstName: { type: String, required: true },
    lastName: { type: String },
    mobilePhone: { type: String },
    countryCode: { type: String },
    address: { type :String },
    state: { type: String },
    area: { type: String },
    city: { type: String },
    zipcode: { type: String },
    isProfessional: { type: String },
    isConfirmed: { type: Boolean, default: false },
    // professionType: { type: [String] },
    // pimsCode: { type: String },
    profileImage: [
      {
        url: { type: String },
        originalname: { type: String },
        mimetype: { type: String },
      },
    ],
    dateOfBirth: { type: Date },
  },
  { timestamps: true }
);

// 👇 Explicitly type the model as Model<IUser>
const AppUser: Model<IUser> = models.appUsers as Model<IUser> || model<IUser>('appUsers', userSchema);

export default AppUser;