import { Attachment } from './Attachment'
import { CodeableConcept } from './CodeableConcept'
import { ContactPoint } from './ContactPoint'
import { Extension } from './Extension'
import { HumanName } from './HumanName'
import { Identifier } from './Identifier'
import { Meta } from './Meta'
import { Narrative } from './Narrative'
import { Period } from './Period'
import { Resource } from './Resource'

/**
 * A person who is directly or indirectly involved in the provisioning of healthcare.
 */
export interface Practitioner {
    readonly resourceType: 'Practitioner'
    id?: string
    meta?: Meta
    implicitRules?: string
    language?: string
    text?: Narrative
    contained?: Resource[]
    extension?: Extension[]
    modifierExtension?: Extension[]
    identifier?: Identifier[]
    active?: boolean
    name?: HumanName[]
    telecom?: ContactPoint[]
    address?: PractitionerAddress[]
    gender?: 'male' | 'female' | 'other' | 'unknown'
    birthDate?: string
    photo?: Attachment[]
    qualification?: PractitionerQualification[]
    communication?: CodeableConcept[]
}

export interface PractitionerAddress {
    use?: 'home' | 'work' | 'temp' | 'old' | 'billing'
    type?: 'postal' | 'physical' | 'both'
    text?: string
    line?: string[]
    city?: string
    district?: string
    state?: string
    postalCode?: string
    country?: string
    period?: Period
}

export interface PractitionerQualification {
    identifier?: Identifier[]
    code: CodeableConcept
    period?: Period
    issuer?: {
        display?: string
        reference?: string
    }
}
