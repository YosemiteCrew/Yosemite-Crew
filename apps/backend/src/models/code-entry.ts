import { Schema, model, type HydratedDocument } from "mongoose";

export type CodeSystem = "YOSEMITECODE" | "IDEXX" | "SNOMED" | "VENOM";
export type CodeType =
  | "SPECIES"
  | "BREED"
  | "GENDER"
  | "TEST"
  | "CLINICAL_TERM"
  | "OTHER";

export interface CodeEntryMongo {
  system: CodeSystem;
  code: string;
  display: string;
  type: CodeType;
  active: boolean;
  synonyms?: string[];
  meta?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const CodeEntrySchema = new Schema<CodeEntryMongo>(
  {
    system: { type: String, required: true, index: true },
    code: { type: String, required: true },
    display: { type: String, required: true },
    type: { type: String, required: true, index: true },
    active: { type: Boolean, default: true, index: true },
    synonyms: { type: [String], default: [] },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: "code_entries" },
);

CodeEntrySchema.index({ system: 1, code: 1 }, { unique: true });
CodeEntrySchema.index({ system: 1, type: 1, active: 1 });

export type CodeEntryDocument = HydratedDocument<CodeEntryMongo>;

export default model<CodeEntryMongo>("CodeEntry", CodeEntrySchema);
