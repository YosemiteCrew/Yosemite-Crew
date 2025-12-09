import { Schema, model, HydratedDocument } from "mongoose";

export type TaskKind =
  | "MEDICATION"
  | "OBSERVATION_TOOL"
  | "HYGIENE"
  | "DIET"
  | "CUSTOM";

interface TaskLibraryDefinitionMongo {
  source: "YC_LIBRARY";
  kind: TaskKind;

  category: string; // e.g. Health - parasite prevention
  name: string; // e.g. Give medication
  defaultDescription?: string;

  schema: {
    medicationFields?: {
      hasMedicationName?: boolean;
      hasType?: boolean;
      hasDosage?: boolean;
      hasFrequency?: boolean;
    };
    requiresObservationTool?: boolean;
    allowsRecurrence?: boolean;
  };

  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

const MedicationFieldsSchema = new Schema(
  {
    hasMedicationName: Boolean,
    hasType: Boolean,
    hasDosage: Boolean,
    hasFrequency: Boolean,
  },
  { _id: false },
);

const LibrarySchema = new Schema<TaskLibraryDefinitionMongo>(
  {
    source: { type: String, enum: ["YC_LIBRARY"], required: true },

    kind: {
      type: String,
      enum: ["MEDICATION", "OBSERVATION_TOOL", "HYGIENE", "DIET", "CUSTOM"],
      required: true,
    },

    category: { type: String, required: true },
    name: { type: String, required: true },
    defaultDescription: { type: String },

    schema: {
      medicationFields: { type: MedicationFieldsSchema, default: {} },
      requiresObservationTool: Boolean,
      allowsRecurrence: Boolean,
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type TaskLibraryDefinitionDocument =
  HydratedDocument<TaskLibraryDefinitionMongo>;
export default model<TaskLibraryDefinitionMongo>(
  "TaskLibraryDefinition",
  LibrarySchema,
);
