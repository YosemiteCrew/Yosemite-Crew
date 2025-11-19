import { Schema, model, type HydratedDocument, type Types } from "mongoose";
import type {
  CompanionParentLink,
  ParentCompanionPermissions,
  ParentCompanionRole,
  ParentCompanionStatus,
} from "@yosemite-crew/types";

export interface ParentCompanionMongo {
  parentId: Types.ObjectId;
  companionId: Types.ObjectId;
  role: ParentCompanionRole;
  status: ParentCompanionStatus;
  permissions: ParentCompanionPermissions;
  invitedByParentId?: Types.ObjectId;
  acceptedAt?: Date;
}

const PermissionsSchema = new Schema<ParentCompanionPermissions>(
  {
    assignAsPrimaryParent: { type: Boolean, default: false },
    emergencyBasedPermissions: { type: Boolean, default: false },
    appointments: { type: Boolean, default: false },
    companionProfile: { type: Boolean, default: false },
    documents: { type: Boolean, default: false },
    expenses: { type: Boolean, default: false },
    tasks: { type: Boolean, default: false },
    chatWithVet: { type: Boolean, default: false },
  },
  { _id: false },
);

const ParentCompanionSchema = new Schema<ParentCompanionMongo>(
  {
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
      index: true,
    },
    companionId: {
      type: Schema.Types.ObjectId,
      ref: "Companion",
      required: true,
      index: true,
    },
    role: { type: String, enum: ["PRIMARY", "CO_PARENT"], required: true },
    status: {
      type: String,
      enum: ["ACTIVE", "PENDING", "REVOKED"],
      default: "ACTIVE",
      required: true,
    },
    permissions: { type: PermissionsSchema, required: true },
    invitedByParentId: { type: Schema.Types.ObjectId, ref: "Parent" },
    acceptedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

ParentCompanionSchema.index({ parentId: 1, companionId: 1 }, { unique: true });
ParentCompanionSchema.index(
  { companionId: 1 },
  {
    name: "unique_active_primary_per_companion",
    unique: true,
    partialFilterExpression: { role: "PRIMARY", status: "ACTIVE" },
  },
);

export type ParentCompanionDocument = HydratedDocument<ParentCompanionMongo>;

export const toCompanionParentLink = (
  document: ParentCompanionDocument,
): CompanionParentLink => {
  const obj = document.toObject({ virtuals: false }) as ParentCompanionMongo & {
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    parentId: obj.parentId.toString(),
    role: obj.role,
    status: obj.status,
    permissions: obj.permissions,
    invitedByParentId: obj.invitedByParentId?.toString(),
    acceptedAt: obj.acceptedAt?.toISOString(),
    createdAt: obj.createdAt?.toISOString(),
    updatedAt: obj.updatedAt?.toISOString(),
  };
};

const ParentCompanionModel = model<ParentCompanionMongo>(
  "ParentCompanion",
  ParentCompanionSchema,
);

export default ParentCompanionModel;
