import { Schema, model, HydratedDocument } from "mongoose";

export type OrgDocumentCategory =
  | "TERMS_AND_CONDITIONS"
  | "PRIVACY_POLICY"
  | "CANCELLATION_POLICY"
  | "FIRE_SAFETY"
  | "GENERAL";

export interface OrganizationDocumentMongo {
  organisationId: string;

  title: string;
  description?: string;

  category: OrgDocumentCategory;

  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;

  visibility: "INTERNAL" | "PUBLIC";

  // Optional version number if they replace file (useful for legal docs)
  version?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export type OrganizationDocumentDocument =
  HydratedDocument<OrganizationDocumentMongo>;

const OrganisationDocumentSchema = new Schema<OrganizationDocumentMongo>(
  {
    organisationId: {
      type: String,
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    category: {
      type: String,
      enum: [
        "TERMS_AND_CONDITIONS",
        "PRIVACY_POLICY",
        "CANCELLATION_POLICY",
        "FIRE_SAFETY",
        "GENERAL",
      ],
      required: true,
    },

    fileUrl: {
      type: String,
    },

    fileName: {
      type: String,
    },

    fileType: {
      type: String,
    },

    fileSize: {
      type: Number,
      default: null,
    },

    visibility: {
      type: String,
      enum: ["INTERNAL", "PUBLIC"],
      default: "INTERNAL",
    },

    version: {
      type: Number,
      default: 1, // increment whenever file is replaced
    },
  },
  { timestamps: true },
);

const OrganizationDocumentModel = model<OrganizationDocumentMongo>(
  "OrganizationDocument",
  OrganisationDocumentSchema,
);

export default OrganizationDocumentModel;
