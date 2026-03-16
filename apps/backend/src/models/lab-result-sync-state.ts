import { Schema, model, type HydratedDocument } from "mongoose";

export interface LabResultSyncStateMongo {
  provider: string;
  lastBatchId?: string | null;
  lastTimestamp?: string | null;
  lastPolledAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const LabResultSyncStateSchema = new Schema<LabResultSyncStateMongo>(
  {
    provider: { type: String, required: true, unique: true },
    lastBatchId: { type: String, default: null },
    lastTimestamp: { type: String, default: null },
    lastPolledAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "lab_result_sync_states" },
);

export type LabResultSyncStateDocument = HydratedDocument<LabResultSyncStateMongo>;

export default model<LabResultSyncStateMongo>(
  "LabResultSyncState",
  LabResultSyncStateSchema,
);
