export type OTFieldType =
  "TEXT" | "NUMBER" | "CHOICE" | "BOOLEAN" | "PHOTO" | "VIDEO";

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

export interface ObservationToolDefinitionDocument extends ObservationToolDefinitionMongo {
  _id: string;
}

export type ObservationToolAnswers = Record<string, unknown>;

export interface ObservationToolSubmissionMongo {
  toolId: string;
  taskId?: string;

  patientId: string;
  filledBy: string;

  answers: ObservationToolAnswers;

  score?: number;
  summary?: string;

  evaluationAppointmentId?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface ObservationToolSubmissionDocument extends ObservationToolSubmissionMongo {
  _id: string;
}
