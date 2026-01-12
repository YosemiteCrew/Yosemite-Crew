import { Schema, model, HydratedDocument } from "mongoose";

export type TaskKind =
  | "MEDICATION"
  | "OBSERVATION_TOOL"
  | "HYGIENE"
  | "DIET"
  | "CUSTOM";

export type Species = "dog" | "cat" | "horse";

const RecurrenceTemplateSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["ONCE", "DAILY", "WEEKLY", "CUSTOM"],
      required: true,
    },
    cronExpression: String,
    editable: { type: Boolean, default: true },
    endAfterDays: Number,
  },
  { _id: false },
);

export interface LibraryRecurrenceTemplate {
  type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
  cronExpression?: string; // for CUSTOM
  editable?: boolean; // can PMS/mobile override?
  endAfterDays?: number; // optional default
}

interface TaskLibraryDefinitionMongo {
  source: "YC_LIBRARY";
  kind: TaskKind;

  category: string;
  name: string;
  defaultDescription?: string;

  schema: {
    medicationFields?: {
      hasMedicationName?: boolean;
      hasType?: boolean;
      hasDosage?: boolean;
      hasFrequency?: boolean;
    };
    requiresObservationTool?: boolean;
    recurrence?: {
      default?: LibraryRecurrenceTemplate;
    };
  };

  isActive: boolean;
  applicableSpecies?: Species[];

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

// ✅ Fix: wrap entire schema field inside a sub-schema
const LibraryInnerSchema = new Schema(
  {
    medicationFields: { type: MedicationFieldsSchema, default: {} },
    requiresObservationTool: { type: Boolean, default: false },
    recurrence: {
      default: RecurrenceTemplateSchema,
    },
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
    defaultDescription: String,

    schema: {
      type: LibraryInnerSchema,
      required: true,
    },
    applicableSpecies: { type: [String], enum: ["dog", "cat", "horse"] },
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
