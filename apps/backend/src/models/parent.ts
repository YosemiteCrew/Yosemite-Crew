import { HydratedDocument, Schema, model, Types } from "mongoose";

const AddressSchema = new Schema(
  {
    addressLine: { type: String },
    country: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { _id: false },
);

export interface ParentMongo {
  firstName: string;
  lastName?: string;
  birthDate?: Date;

  email: string;
  phoneNumber?: string;

  currency?: string;
  profileImageUrl?: string;
  isProfileComplete?: boolean;

  linkedUserId?: Types.ObjectId | null;

  createdFrom: "pms" | "mobile" | "invited";

  address: {
    addressLine?: string;
    country?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
  };

  createdAt?: Date;
  updatedAt?: Date;
}

const ParentSchema = new Schema<ParentMongo>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String },
    birthDate: { type: Date },

    email: { type: String, required: true, lowercase: true, index: true },
    phoneNumber: { type: String },

    currency: { type: String },
    profileImageUrl: { type: String },
    isProfileComplete: { type: Boolean, default: false },

    linkedUserId: {
      type: Schema.Types.ObjectId,
      ref: "AuthUserMobile",
      default: null,
    },

    createdFrom: {
      type: String,
      enum: ["pms", "mobile", "invited"],
      required: true,
    },

    address: { type: AddressSchema },
  },
  { timestamps: true },
);

export type ParentDocument = HydratedDocument<ParentMongo>;

export const ParentModel = model<ParentMongo>("Parent", ParentSchema);
