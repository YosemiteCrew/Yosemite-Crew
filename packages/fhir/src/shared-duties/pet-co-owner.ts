export interface FhirHumanName {
  given?: string[];
  family?: string;
}

export interface FhirCoding {
  display?: string;
}

export interface FhirRelationship {
  coding?: FhirCoding[];
}

export interface CoOwnerFhirData {
  name?: FhirHumanName[];
  relationship?: FhirRelationship[];
}