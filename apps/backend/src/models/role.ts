import { Schema, model } from "mongoose";
import { IRole } from "@yosemite-crew/types"

const roleSchema = new Schema<IRole>({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  permissions: { type: Map, of: [String], default: {} },
});

export const Role = model<IRole>("Role", roleSchema);

