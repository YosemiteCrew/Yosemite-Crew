import { Schema, model, Types, HydratedDocument } from "mongoose";

export interface CompanionOrganisationMongo {
  companionId: Types.ObjectId;
  organisationId?: Types.ObjectId | null;
  linkedByParentId?: Types.ObjectId | null;
  linkedByPmsUserId?: string | null;
  organisationType: "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";
  role: "ORGANISATION";
  status: "ACTIVE" | "PENDING" | "REVOKED";
  invitedViaEmail?: string | null;
  inviteToken?: string | null;
  acceptedAt?: Date | null;
  rejectedAt?: Date | null;
}

const CompanionOrganisationSchema = new Schema<CompanionOrganisationMongo>(
  {
    companionId: {
      type: Schema.Types.ObjectId,
      ref: "Companion",
      required: true,
      index: true,
    },
    organisationId: {
      type: Schema.Types.ObjectId,
      ref: "Organisation",
      default: null,
      index: true,
    },
    linkedByParentId: {
      type: Schema.Types.ObjectId,
      ref: "Parent",
      default: null,
    },
    linkedByPmsUserId: {
      type: String,
      ref: "User",
      default: null,
    },
    organisationType: {
      type: String,
      enum: ["HOSPITAL", "BREEDER", "BOARDER", "GROOMER"],
      required: true,
    },
    role: {
      type: String,
      enum: ["ORGANISATION"],
      required: true,
      default: "ORGANISATION",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "PENDING", "REVOKED"],
      required: true,
      default: "ACTIVE",
    },
    invitedViaEmail: { type: String, default: null },
    inviteToken: { type: String, default: null },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

/**
 * Prevent duplicate active links between companion + organisation
 * (PMS OR external that later becomes PMS)
 */
CompanionOrganisationSchema.index(
  { companionId: 1, organisationId: 1, organisationType: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "ACTIVE" },
  },
);

export type CompanionOrganisationDocument =
  HydratedDocument<CompanionOrganisationMongo>;

const CompanionOrganisationModel = model<CompanionOrganisationMongo>(
  "CompanionOrganisation",
  CompanionOrganisationSchema,
);

export default CompanionOrganisationModel;
