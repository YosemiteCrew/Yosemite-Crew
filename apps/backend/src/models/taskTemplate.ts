import { Schema, model, HydratedDocument } from "mongoose";
import { TaskKind } from "./taskLibraryDefinition";

interface TaskTemplateMongo {
  source: "ORG_TEMPLATE";
  organisationId: string;

  libraryTaskId?: string; // Reference to YC library definition

  category: string; // Template/Library/Custom
  name: string;
  description?: string;

  kind: TaskKind;
  defaultRole: "EMPLOYEE" | "PARENT";

  defaultMedication?: {
    name?: string;
    type?: string;
    dosage?: string;
    frequency?: string;
  };

  defaultObservationToolId?: string;

  defaultRecurrence?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    customCron?: string;
    defaultEndOffsetDays?: number;
  };

  defaultReminderOffsetMinutes?: number;

  isActive: boolean;
  createdBy: string;

  createdAt?: Date;
  updatedAt?: Date;
}

const MedicationSchema = new Schema(
  {
    name: String,
    type: String,
    dosage: String,
    frequency: String,
  },
  { _id: false },
);

const RecurrenceSchema = new Schema(
  {
    type: { type: String, enum: ["ONCE", "DAILY", "WEEKLY", "CUSTOM"] },
    customCron: String,
    defaultEndOffsetDays: Number,
  },
  { _id: false },
);

const TaskTemplateSchema = new Schema<TaskTemplateMongo>(
  {
    source: { type: String, enum: ["ORG_TEMPLATE"], required: true },
    organisationId: { type: String, required: true },

    libraryTaskId: { type: String },

    category: { type: String, required: true },
    name: { type: String, required: true },
    description: String,

    kind: {
      type: String,
      enum: ["MEDICATION", "OBSERVATION_TOOL", "HYGIENE", "DIET", "CUSTOM"],
      required: true,
    },

    defaultRole: { type: String, enum: ["EMPLOYEE", "PARENT"], required: true },

    defaultMedication: { type: MedicationSchema, default: {} },
    defaultObservationToolId: String,

    defaultRecurrence: { type: RecurrenceSchema },

    defaultReminderOffsetMinutes: Number,

    isActive: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

export type TaskTemplateDocument = HydratedDocument<TaskTemplateMongo>;
export default model<TaskTemplateMongo>("TaskTemplate", TaskTemplateSchema);
