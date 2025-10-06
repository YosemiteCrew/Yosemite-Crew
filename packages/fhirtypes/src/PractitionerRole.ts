import { CodeableConcept } from './CodeableConcept'
import { ContactPoint } from './ContactPoint'
import { Endpoint } from './Endpoint'
import { Extension } from './Extension'
import { HealthcareService } from './HealthcareService'
import { Identifier } from './Identifier'
import { Location } from './Location'
import { Meta } from './Meta'
import { Narrative } from './Narrative'
import { Period } from './Period'
import { Reference } from './Reference'
import { Resource } from './Resource'
import { Organization } from './Organization'
import { Practitioner } from './Practitioner'

/**
 * A specific set of Roles/Locations/specialties/services that a practitioner may perform, or has performed at an organization for a period of time.
 */
export interface PractitionerRole {
    /**
     * This is a PractitionerRole resource
     */
    readonly resourceType: 'PractitionerRole'

    /**
     * The logical id of the resource, as used in the URL for the resource.
     * Once assigned, this value never changes.
     */
    id?: string

    /**
     * The metadata about the resource. This is content that is maintained by the infrastructure.
     */
    meta?: Meta

    /**
     * A reference to a set of rules that were followed when the resource was constructed.
     */
    implicitRules?: string

    /**
     * The base language in which the resource is written.
     */
    language?: string

    /**
     * A human-readable narrative that contains a summary of the resource.
     */
    text?: Narrative

    /**
     * Contained, inline Resources.
     */
    contained?: Resource[]

    /**
     * May be used to represent additional information that is not part of the basic definition of the resource.
     */
    extension?: Extension[]

    /**
     * May be used to represent additional information that modifies the understanding of the element that contains it.
     */
    modifierExtension?: Extension[]

    /**
     * Business identifiers that are specific to a role/location.
     */
    identifier?: Identifier[]

    /**
     * Whether this practitioner role record is in active use.
     */
    active?: boolean

    /**
     * The period during which the person is authorized to act in the described role for the organization.
     */
    period?: Period

    /**
     * Practitioner that is able to provide the defined services for the organization.
     */
    practitioner?: Reference<Practitioner>

    /**
     * The organization where the Practitioner performs the roles associated.
     */
    organization?: Reference<Organization>

    /**
     * Roles which this practitioner may perform.
     */
    code?: CodeableConcept[]

    /**
     * Specific specialty of the practitioner.
     */
    specialty?: CodeableConcept[]

    /**
     * Location(s) at which this practitioner provides care.
     */
    location?: Reference<Location>[]

    /**
     * Healthcare services provided through the role.
     */
    healthcareService?: Reference<HealthcareService>[]

    /**
     * Contact details that are specific to the practitioner while performing their role.
     */
    telecom?: ContactPoint[]

    /**
     * The period during which the practitioner is performing the role at the organization.
     */
    availableTime?: PractitionerRoleAvailableTime[]

    /**
     * Not available time slots for the practitioner.
     */
    notAvailable?: PractitionerRoleNotAvailable[]

    /**
     * The endpoints available for this role.
     */
    endpoint?: Reference<Endpoint>[]
}

export interface PractitionerRoleAvailableTime {
    daysOfWeek?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[]
    allDay?: boolean
    availableStartTime?: string
    availableEndTime?: string
}

export interface PractitionerRoleNotAvailable {
    description?: string
    during?: Period
}
