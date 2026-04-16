import { Schema, model, HydratedDocument } from "mongoose";
import type { ToFHIROrganizationOptions } from "@yosemite-crew/types";

const GeoPointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: (value: unknown) =>
          Array.isArray(value) &&
          value.length === 2 &&
          value.every((v) => typeof v === "number" && Number.isFinite(v)),
        message: "GeoJSON Point coordinates must be [lng, lat].",
      },
    },
  },
  { _id: false },
);

const AddressSchema = new Schema(
  {
    addressLine: { type: String },
    country: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },

    location: { type: GeoPointSchema, required: false },
  },
  { _id: false },
);

export interface OrganizationMongo {
  fhirId?: string;
  name: string;
  taxId: string;
  DUNSNumber?: string;
  imageURL?: string;
  type: "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";
  petNamePreference?: "COMPANION" | "ANIMAL" | "PATIENT";
  phoneNo: string;
  website?: string;
  documensoTeamId?: string;
  documensoApiKey?: string;
  address?: {
    addressLine?: string;
    country?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    location?: {
      type: "Point";
      coordinates: [number, number];
    };
  };
  isVerified?: boolean;
  isActive?: boolean;
  typeCoding?: ToFHIROrganizationOptions["typeCoding"];
  healthAndSafetyCertNo?: string;
  animalWelfareComplianceCertNo?: string;
  fireAndEmergencyCertNo?: string;
  googlePlacesId?: string;
  stripeAccountId?: string;
  averageRating?: number;
  ratingCount?: number;
  appointmentCheckInBufferMinutes?: number;
  appointmentCheckInRadiusMeters?: number;
}

const OrganizationSchema = new Schema<OrganizationMongo>(
  {
    fhirId: { type: String },
    name: { type: String, required: true },
    taxId: { type: String, required: true },
    DUNSNumber: { type: String },
    imageURL: { type: String },
    documensoTeamId: { type: String },
    documensoApiKey: { type: String },
    type: {
      type: String,
      enum: ["HOSPITAL", "BREEDER", "BOARDER", "GROOMER"],
      required: true,
    },
    petNamePreference: {
      type: String,
      enum: ["COMPANION", "ANIMAL", "PATIENT"],
      default: "COMPANION",
    },
    phoneNo: { type: String, required: true },
    website: { type: String },
    address: { type: AddressSchema, required: false },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    healthAndSafetyCertNo: { type: String },
    animalWelfareComplianceCertNo: { type: String },
    fireAndEmergencyCertNo: { type: String },
    typeCoding: {
      system: { type: String },
      code: { type: String },
      display: { type: String },
    },
    googlePlacesId: { type: String },
    stripeAccountId: { type: String },
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    appointmentCheckInBufferMinutes: { type: Number, default: 5 },
    appointmentCheckInRadiusMeters: { type: Number, default: 200 },
  },
  {
    timestamps: true,
  },
);

OrganizationSchema.index({ googlePlacesId: 1, name: 1 });
OrganizationSchema.index({ "address.location": "2dsphere" });
export type OrganizationDocument = HydratedDocument<OrganizationMongo>;

const OrganizationModel = model<OrganizationMongo>(
  "Organization",
  OrganizationSchema,
);

export default OrganizationModel;
