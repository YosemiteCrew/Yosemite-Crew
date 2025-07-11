export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirComponent {
  code?: FhirCodeableConcept; // Optional if you're guarding with ?
  valueString?: string;
  valueQuantity?: {
    value?: number;
    unit?: string;
  };
}

export interface FhirExtension {
  url: string;
  valueString?: string;
  valueBoolean?: boolean;
  
}

export interface FhirReference {
  reference?: string; // e.g., "Pet/123"
}

export interface FhirObservation {
  resourceType: 'Observation';
  subject?: FhirReference;
  effectiveDateTime?: string;
  extension?: FhirExtension[];
  component?: FhirComponent[];
  code?: FhirCodeableConcept;
  ext?: string; // This is not a standard FHIR field, but included for compatibility
}

export interface PetDutyFhirObservationOutput extends FhirObservation {
  status: 'final';
  category: {
    coding: FhirCoding[];
  }[];
  subject: FhirReference;
  effectiveDateTime: string; // ISO timestamp
  extension: FhirExtension[];
  component: FhirComponent[];
}