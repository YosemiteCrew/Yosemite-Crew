import { BackboneElement } from "./BackboneElement";
import { CodeableConcept } from "./CodeableConcept";
import { Extension } from "./Extension";
import { Identifier } from "./Identifier";
import { Meta } from "./Meta";
import { Narrative } from "./Narrative";
import { Period } from "./Period";
import { Reference } from "./Reference";
import { Resource } from "./Resource";

/**
 * A booking of healthcare related services provided by a practitioner,
 * location, or other resources for a specific time period.
 */
export interface Appointment {
  readonly resourceType: "Appointment";
  id?: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  text?: Narrative;
  contained?: Resource[];
  extension?: Extension[];
  modifierExtension?: Extension[];
  identifier?: Identifier[];
  status: string;
  cancelationReason?: CodeableConcept;
  serviceCategory?: CodeableConcept[];
  serviceType?: CodeableConcept[];
  speciality?: CodeableConcept[];
  appointmentType?: CodeableConcept;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  priority?: number;
  description?: string;
  supportingInformation?: Reference[];
  start?: string;
  end?: string;
  minutesDuration?: number;
  slot?: Reference[];
  created?: string;
  comment?: string;
  patientInstruction?: string;
  basedOn?: Reference[];
  participant: AppointmentParticipant[];
  requestedPeriod?: Period[];
}

/**
 * Participants involved in the appointment (patients, practitioners, etc).
 */
export interface AppointmentParticipant extends BackboneElement {
  type?: CodeableConcept[];
  actor?: Reference;
  required?: string;
  status: string;
  period?: Period;
  extension?: Extension[];
}
