import { Attachment } from './Attachment';
import { CodeableConcept } from './CodeableConcept';
import { Extension } from './Extension';
import { HumanName } from './HumanName';
import { Identifier } from './Identifier';
import { Meta } from './Meta';
import { Narrative } from './Narrative';
import { Resource } from './Resource';

/**
 * A person or animal receiving care.
 */
export interface Patient {
    readonly resourceType: 'Patient';
    id?: string;
    meta?: Meta;
    implicitRules?: string;
    language?: string;
    text?: Narrative;
    contained?: Resource[];
    extension?: Extension[];
    modifierExtension?: Extension[];
    identifier?: Identifier[];
    active?: boolean;
    name?: HumanName[];
    gender?: 'male' | 'female' | 'other' | 'unknown';
    birthDate?: string;
    photo?: Attachment[];
    animal?: PatientAnimal;
}

export interface PatientAnimal {
    species?: CodeableConcept;
    breed?: CodeableConcept;
    genderStatus?: CodeableConcept;
}
