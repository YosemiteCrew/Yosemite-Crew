import { Schema, model, HydratedDocument } from "mongoose";

export interface UserOrganizationMongo {
  fhirId?: string;
  practitionerReference: string;
  organizationReference: string;
  roleCode: string;
  roleDisplay?: string;
  active: boolean;
  extraPermissions?: string[];
  effectivePermissions?: string[];
}

const UserOrganizationSchema = new Schema<UserOrganizationMongo>(
  {
    fhirId: { type: String },
    practitionerReference: { type: String, required: true },
    organizationReference: { type: String, required: true },
    roleCode: { type: String, required: true },
    roleDisplay: { type: String },
    active: { type: Boolean, default: true },
    extraPermissions: {
      type: [String],
      default: [],
    },
    effectivePermissions: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

UserOrganizationSchema.index(
  { practitionerReference: 1, organizationReference: 1, roleCode: 1 },
  { unique: true, name: "unique_user_org_role" },
);

export type UserOrganizationDocument = HydratedDocument<UserOrganizationMongo>;

const UserOrganizationModel = model<UserOrganizationMongo>(
  "UserOrganization",
  UserOrganizationSchema,
);

export default UserOrganizationModel;
