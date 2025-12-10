import { Schema, model, HydratedDocument } from "mongoose";

const OrganisationRoomSchema = new Schema(
  {
    fhirId: { type: String, index: true },
    organisationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["CONSULTATION", "WAITING_AREA", "SURGERY", "ICU"],
    },
    assignedSpecialiteis: { type: [String], default: undefined },
    assignedStaffs: { type: [String], default: undefined },
  },
  {
    timestamps: true,
  },
);

export interface OrganisationRoomMongo {
  fhirId?: string;
  organisationId: string;
  name: string;
  type: "CONSULTATION" | "WAITING_AREA" | "SURGERY" | "ICU";
  assignedSpecialiteis?: string[];
  assignedStaffs?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type OrganisationRoomDocument = HydratedDocument<OrganisationRoomMongo>;

const OrganisationRoomModel = model<OrganisationRoomMongo>(
  "OrganisationRoom",
  OrganisationRoomSchema,
);

export default OrganisationRoomModel;
