export type CodeSystem = "YOSEMITECODE" | "IDEXX" | "SNOMED" | "VENOM";
export type CodeType =
  "SPECIES" | "BREED" | "GENDER" | "TEST" | "CLINICAL_TERM" | "OTHER";

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

export interface CodeEntryDocument extends CodeEntryMongo {
  _id: string;
}
