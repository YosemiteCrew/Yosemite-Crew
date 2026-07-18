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

export interface CodeMappingDocument extends CodeMappingMongo {
  _id: string;
}
