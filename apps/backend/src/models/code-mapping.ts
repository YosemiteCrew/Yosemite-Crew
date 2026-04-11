import { Schema, model, type HydratedDocument } from "mongoose";
import type { CodeSystem } from "./code-entry";

export interface CodeMappingMongo {
  sourceSystem: CodeSystem;
  sourceCode: string;
  targetSystem: CodeSystem;
  targetCode: string;
  targetDisplay?: string | null;
  targetVersion?: string | null;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const CodeMappingSchema = new Schema<CodeMappingMongo>(
  {
    sourceSystem: { type: String, required: true, index: true },
    sourceCode: { type: String, required: true },
    targetSystem: { type: String, required: true, index: true },
    targetCode: { type: String, required: true },
    targetDisplay: { type: String, default: null },
    targetVersion: { type: String, default: null },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: "code_mappings" },
);

CodeMappingSchema.index(
  { sourceSystem: 1, sourceCode: 1, targetSystem: 1, targetCode: 1 },
  { unique: true },
);
CodeMappingSchema.index({ sourceSystem: 1, sourceCode: 1 });
CodeMappingSchema.index({ targetSystem: 1, targetCode: 1 });

export type CodeMappingDocument = HydratedDocument<CodeMappingMongo>;

export default model<CodeMappingMongo>("CodeMapping", CodeMappingSchema);
