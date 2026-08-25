/** FHIR ConceptMap equivalence, describing how exactly a crosswalk holds. */
export type MappingEquivalence =
  | "RELATEDTO"
  | "EQUIVALENT"
  | "EQUAL"
  | "WIDER"
  | "SUBSUMES"
  | "NARROWER"
  | "SPECIALIZES"
  | "INEXACT"
  | "UNMATCHED"
  | "DISJOINT";

import type { CodeSystem } from "./code-entry";

export interface CodeMappingMongo {
  sourceSystem: CodeSystem;
  sourceCode: string;
  targetSystem: CodeSystem;
  targetCode: string;
  targetDisplay?: string | null;
  targetVersion?: string | null;
  equivalence?: MappingEquivalence;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CodeMappingDocument extends CodeMappingMongo {
  _id: string;
}
