export interface FhirReference {
  reference: string;
}

export interface FhirExtension {
  url: string;
  valueString?: string;
}

export interface FhirCarePlan {
  resourceType: "CarePlan";
  id: string;
  status: string;
  intent: string;
  subject: FhirReference;
  author: FhirReference[];
  description: string;
  extension: FhirExtension[];
}
