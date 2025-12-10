import { Schema, model, HydratedDocument } from "mongoose";

export type OTFieldType =
  | "TEXT"
  | "NUMBER"
  | "CHOICE"
  | "BOOLEAN"
  | "PHOTO"
  | "VIDEO";

export interface OTField {
  key: string;
  label: string;
  type: OTFieldType;
  required: boolean;
  options?: string[];
  scoring?: {
    points?: number;
    map?: Record<string, number>;
  };
}

export interface ObservationToolDefinitionMongo {
  name: string;
  description?: string;
  category: string;

  fields: OTField[];

  scoringRules?: {
    sumFields?: string[];
    customFormula?: string;
  };

  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const OTFieldSchema = new Schema<OTField>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ["TEXT", "NUMBER", "CHOICE", "BOOLEAN", "PHOTO", "VIDEO"],
      required: true,
    },
    required: { type: Boolean, default: false },
    options: [String],
    scoring: {
      points: Number,
      map: { type: Schema.Types.Mixed },
    },
  },
  { _id: false },
);

const ObservationToolDefinitionSchema =
  new Schema<ObservationToolDefinitionMongo>(
    {
      name: { type: String, required: true },
      description: String,
      category: { type: String, required: true },

      fields: { type: [OTFieldSchema], required: true },

      scoringRules: {
        sumFields: [String],
        customFormula: String,
      },

      isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
  );

export type ObservationToolDefinitionDocument =
  HydratedDocument<ObservationToolDefinitionMongo>;
export const ObservationToolDefinitionModel =
  model<ObservationToolDefinitionMongo>(
    "ObservationToolDefinition",
    ObservationToolDefinitionSchema,
  );

export type ObservationToolAnswers = Record<string, unknown>;

export interface ObservationToolSubmissionMongo {
  toolId: string;
  taskId?: string;

  companionId: string;
  filledBy: string;

  answers: ObservationToolAnswers;

  score?: number;
  summary?: string;

  evaluationAppointmentId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

const ObservationToolSubmissionSchema =
  new Schema<ObservationToolSubmissionMongo>(
    {
      toolId: { type: String, required: true },
      taskId: String,

      companionId: { type: String, required: true },
      filledBy: { type: String, required: true },

      answers: { type: Schema.Types.Mixed, required: true },

      score: Number,
      summary: String,

      evaluationAppointmentId: String,
    },
    { timestamps: true },
  );

export type ObservationToolSubmissionDocument =
  HydratedDocument<ObservationToolSubmissionMongo>;
export const ObservationToolSubmissionModel =
  model<ObservationToolSubmissionMongo>(
    "ObservationToolSubmission",
    ObservationToolSubmissionSchema,
  );
