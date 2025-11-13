import { HydratedDocument, Schema, model } from "mongoose";

export interface CompanionMongo {
  name: string;
  type: string;
  breed: string;
  dateOfBirth: Date;
  gender: string;
  photoUrl?: string;

  currentWeight?: number;
  colour?: string;
  allergy?: string;
  bloodGroup?: string;

  isNeutered?: boolean;
  ageWhenNeutered?: string;

  microchipNumber?: string;
  passportNumber?: string;

  isInsured: boolean;
  insurance?: {
    isInsured: boolean;
    companyName?: string;
    policyNumber?: string;
  } | null;

  countryOfOrigin?: string;
  source?: string;
  status?: string;

  physicalAttribute?: {
    coatType?: string;
    coatColour?: string;
    eyeColour?: string;
    height?: string;
    weight?: string;
    markings?: string;
    build?: string;
  };

  breedingInfo?: {
    sire?: {
      name?: string;
      registrationNumber?: string;
      breed?: string;
      microchipNumber?: string;
      dateOfBirth?: Date;
      ownerBreederName?: string;
    };
    dam?: {
      name?: string;
      registrationNumber?: string;
      breed?: string;
      microchipNumber?: string;
      dateOfBirth?: Date;
      ownerBreederName?: string;
    };
  };

  medicalRecords?: Array<{
    fileUrl: string;
    fileName: string;
    uploadedAt: Date;
  }>;

  isProfileComplete?: boolean
  createdAt?: Date;
  updatedAt?: Date;
}

const PhysicalAttributeSchema = new Schema(
  {
    coatType: String,
    coatColour: String,
    eyeColour: String,
    height: String,
    weight: String,
    markings: String,
    build: String,
  },
  { _id: false }
);

const BreedingParentSchema = new Schema(
  {
    name: String,
    registrationNumber: String,
    breed: String,
    microchipNumber: String,
    dateOfBirth: Date,
    ownerBreederName: String,
  },
  { _id: false }
);

const BreedingInfoSchema = new Schema(
  {
    sire: { type: BreedingParentSchema, default: undefined },
    dam: { type: BreedingParentSchema, default: undefined },
  },
  { _id: false }
);

const MedicalRecordSchema = new Schema(
  {
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false }
);

const InsuranceSchema = new Schema(
  {
    isInsured: { type: Boolean, required: true },
    companyName: String,
    policyNumber: String,
  },
  { _id: false }
);

const CompanionSchema = new Schema<CompanionMongo>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    breed: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, required: true },
    photoUrl: String,

    currentWeight: Number,
    colour: String,
    allergy: String,
    bloodGroup: String,

    isNeutered: Boolean,
    ageWhenNeutered: String,

    microchipNumber: String,
    passportNumber: String,

    isInsured: { type: Boolean, required: true, default: false },
    insurance: { type: InsuranceSchema, default: null },

    countryOfOrigin: String,
    source: String,
    status: String,

    physicalAttribute: { type: PhysicalAttributeSchema, default: undefined },

    breedingInfo: { type: BreedingInfoSchema, default: undefined },

    medicalRecords: {
      type: [MedicalRecordSchema],
      default: undefined,
    },

    isProfileComplete: {type: Boolean, required: true, default: false}
  },
  { timestamps: true }
);

export type CompanionDocument = HydratedDocument<CompanionMongo>;
export default model<CompanionMongo>("Companion", CompanionSchema);
