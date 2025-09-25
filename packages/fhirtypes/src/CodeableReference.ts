import { CodeableConcept } from "./CodeableConcept";
import { Extension } from "./Extension";
import { Reference } from "./Reference";

export interface CodeableReference {
    id? : string;

    extension? : Extension[];

    concept? : CodeableConcept;

    reference? : Reference;
}