import { Schema, model, HydratedDocument } from "mongoose";
import type {
  AdverseEventCompanionInfo,
  AdverseEventConsent,
  AdverseEventDestinations,
  AdverseEventProductInfo,
  AdverseEventReporterInfo,
  AdverseEventStatus,
} from "@yosemite-crew/types";

const ReporterSchema = new Schema(
  {
    userId: { type: String },
    type: {
      type: String,
      enum: ["PARENT", "CO_PARENT", "CLINIC_STAFF"],
      required: true,
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phoneNumber: { type: String },
    email: { type: String, required: true },
    dateOfBirth: { type: String },
    addressLine: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
    currency: { type: String },
  },
  { _id: false },
);

const CompanionSchema = new Schema(
  {
    companionId: { type: String },
    name: { type: String, required: true },
    breed: { type: String },
    dateOfBirth: { type: String },
    gender: { type: String },
    currentWeight: { type: String },
    color: { type: String },
    neuteredStatus: { type: String },
    bloodGroup: { type: String },
    microchipNumber: { type: String },
    passportNumber: { type: String },
    insured: { type: String },
    insuranceCompany: { type: String },
    insurancePolicyNumber: { type: String },
    countryOfOrigin: { type: String },
    originDetails: { type: String },
  },
  { _id: false },
);

const ProductSchema = new Schema(
  {
    productName: { type: String, required: true },
    brandName: { type: String },
    manufacturingCountry: { type: String },
    batchNumber: { type: String },
    numberOfTimesUsed: { type: Number },
    quantityUsed: { type: Number },
    dosageForm: { type: String },
    administrationRoute: { type: String },
    reasonToUse: { type: String },
    conditionBefore: { type: String },
    conditionAfter: { type: String },
    eventDate: { type: String },
    productImageUrl: { type: String },
  },
  { _id: false },
);

const DestinationsSchema = new Schema(
  {
    sendToManufacturer: { type: Boolean, default: false },
    sendToHospital: { type: Boolean, default: false },
    sendToAuthority: { type: Boolean, default: false },
  },
  { _id: false },
);

const ConsentSchema = new Schema(
  {
    agreedToContact: { type: Boolean, default: false },
    agreedToTermsAt: { type: Date },
  },
  { _id: false },
);

export interface AdverseEventReportMongo {
  organisationId?: string;
  appointmentId?: string | null;
  reporter: AdverseEventReporterInfo;
  companion: AdverseEventCompanionInfo;
  product: AdverseEventProductInfo;
  destinations: AdverseEventDestinations;
  consent: AdverseEventConsent;
  status: AdverseEventStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

const AdverseEventReportSchema = new Schema<AdverseEventReportMongo>(
  {
    organisationId: { type: String, index: true },
    appointmentId: { type: String },

    reporter: { type: ReporterSchema, required: true },
    companion: { type: CompanionSchema, required: true },
    product: { type: ProductSchema, required: true },
    destinations: { type: DestinationsSchema, required: true },
    consent: { type: ConsentSchema, required: true },

    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "REVIEWING", "FORWARDED", "CLOSED"],
      default: "SUBMITTED",
      index: true,
    },
  },
  { timestamps: true },
);

export type AdverseEventReportDocument =
  HydratedDocument<AdverseEventReportMongo>;

const AdverseEventReportModel = model<AdverseEventReportMongo>(
  "AdverseEventReport",
  AdverseEventReportSchema,
);

export default AdverseEventReportModel;
