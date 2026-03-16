import { Schema, model, type HydratedDocument } from "mongoose";
import type {
  IntegrationProvider,
  IntegrationStatus,
  IntegrationCredentialsStatus,
} from "src/integrations";

export interface IntegrationAccountMongo {
  organisationId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  enabledAt?: Date | null;
  disabledAt?: Date | null;
  lastSyncAt?: Date | null;
  lastError?: string | null;
  credentialsStatus?: IntegrationCredentialsStatus;
  lastValidatedAt?: Date | null;
  credentials?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const IntegrationAccountSchema = new Schema<IntegrationAccountMongo>(
  {
    organisationId: { type: String, required: true, index: true },
    provider: {
      type: String,
      required: true,
      enum: ["IDEXX", "MERCK_MANUALS"],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["enabled", "disabled", "error", "pending"],
      default: "disabled",
    },
    enabledAt: { type: Date, default: null },
    disabledAt: { type: Date, default: null },
    lastSyncAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    credentialsStatus: {
      type: String,
      enum: ["missing", "invalid", "valid", "pending"],
      default: "missing",
    },
    lastValidatedAt: { type: Date, default: null },
    credentials: { type: Schema.Types.Mixed, default: null },
    config: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        delete ret.credentials;
        return ret;
      },
    },
    toObject: {
      transform: (_, ret) => {
        delete ret.credentials;
        return ret;
      },
    },
  },
);

IntegrationAccountSchema.index(
  { organisationId: 1, provider: 1 },
  { unique: true },
);

export type IntegrationAccountDocument =
  HydratedDocument<IntegrationAccountMongo>;

export default model<IntegrationAccountMongo>(
  "IntegrationAccount",
  IntegrationAccountSchema,
);
