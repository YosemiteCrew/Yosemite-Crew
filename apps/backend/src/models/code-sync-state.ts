import { Schema, model, type HydratedDocument } from "mongoose";
import type { CodeSystem } from "./code-entry";

export type CodeSyncKind = "species" | "breeds" | "genders" | "tests";

export interface CodeSyncStateMongo {
  system: CodeSystem;
  kind: CodeSyncKind;
  version: string;
  lastSyncedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const CodeSyncStateSchema = new Schema<CodeSyncStateMongo>(
  {
    system: { type: String, required: true, index: true },
    kind: { type: String, required: true, index: true },
    version: { type: String, required: true },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "code_sync_states" },
);

CodeSyncStateSchema.index({ system: 1, kind: 1 }, { unique: true });

export type CodeSyncStateDocument = HydratedDocument<CodeSyncStateMongo>;

export default model<CodeSyncStateMongo>("CodeSyncState", CodeSyncStateSchema);
