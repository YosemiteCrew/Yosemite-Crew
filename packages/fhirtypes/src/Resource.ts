import { Basic } from "./Basic";
import { Binary } from "./Binary";
import { CodeSystem } from "./CodeSystem";
import { Invoice } from "./Invoice";
import { Questionnaire } from "./Questionnaire";
import { QuestionnaireResponse } from "./QuestionnaireResponse";
import { ValueSet } from "./ValueSet";

interface FhirResource {
  resourceType: string;
}

export type Resource = FhirResource &
  (
    | Basic
    | Binary
    | CodeSystem
    | Invoice
    | JsonWebKey
    | Questionnaire
    | QuestionnaireResponse
    | ValueSet
  );
