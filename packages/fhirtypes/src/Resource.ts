import { Basic } from "./Basic";
import { Binary } from "./Binary";
import { CodeSystem } from "./CodeSystem";
import { Invoice } from "./Invoice";
import { ValueSet } from "./ValueSet";

interface FhirResource {
  resourceType: string;
}

export type Resource = FhirResource &
  (Basic | Binary | CodeSystem | Invoice | JsonWebKey | ValueSet);
