import type {
  Appointment as FHIRAppointment,
  AppointmentParticipant,
  CodeableConcept,
  Extension,
} from '@yosemite-crew/fhir';
import dayjs from 'dayjs';
import { SPECIES_SYSTEM_URL } from './companion';
import type { AppointmentKind } from './catalog';
import type { TemplateKind } from './template';

export type AppointmentStatus =
  | 'REQUESTED'
  | 'UPCOMING'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type AppointmentPaymentStatus = 'PAID' | 'UNPAID';

export type AppointmentTemplateDefault = {
  templateKind: TemplateKind;
  templateId: string | undefined;
  templateVersion: number | undefined;
  source: 'CATALOG_BINDING' | 'CATALOG_KIND' | 'ORGANISATION_DEFAULT' | 'LIBRARY_DEFAULT';
};

export type Appointment = {
  id?: string;
  caseId?: string;
  encounterId?: string;
  companion: {
    id: string;
    name: string;
    species: string;
    breed?: string;
    parent: {
      id: string;
      name: string;
    };
  };
  lead?: {
    id: string;
    name: string;
    profileUrl?: string;
  }; // Vet or practitioner being booked
  supportStaff?: {
    id: string;
    name: string;
  }[];
  room?: {
    // Clinic room being booked
    id: string;
    name: string;
  };
  appointmentType?: {
    id: string;
    name: string;
    speciality: {
      id: string;
      name: string;
    };
  };
  appointmentKind?: AppointmentKind;
  organisationId: string; // Org / clinic
  appointmentDate: Date; // Date of the appointment
  startTime: Date; // Booking start timestamp
  timeSlot: string; // Time Slot for the appointment
  durationMinutes: number; // Duration in minutes
  endTime: Date; // Booking end timestamp
  status: AppointmentStatus;
  paymentStatus?: AppointmentPaymentStatus;
  isEmergency?: boolean;
  concern?: string; // Reason for the appointment
  createdAt?: Date;
  updatedAt?: Date;
  attachments?: {
    key?: string;
    name?: string;
    contentType?: string;
  }[];
  formIds?: string[]; // IDs of any forms associated with the appointment
  templateDefaults?: AppointmentTemplateDefault[];
};

const BREED_SYSTEM_URL = 'http://hl7.org/fhir/animal-breed';
const EXT_EMERGENCY = 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-is-emergency';
const EXT_APPOINTMENT_ATTACHMENTS =
  'https://yosemitecrew.com/fhir/StructureDefinition/appointment-attachments';
const EXT_LEAD_PROFILE_URL = 'https://yosemitecrew.com/fhir/StructureDefinition/lead-profile-url';
const EXT_APPOINTMENT_FORM_IDS =
  'https://yosemitecrew.com/fhir/StructureDefinition/appointment-form-id';
const EXT_APPOINTMENT_PAYMENT_STATUS =
  'https://yosemitecrew.com/fhir/StructureDefinition/appointment-payment-status';
const EXT_APPOINTMENT_KIND = 'https://yosemitecrew.com/fhir/StructureDefinition/appointment-kind';
const EXT_APPOINTMENT_CASE_ID =
  'https://yosemitecrew.com/fhir/StructureDefinition/appointment-case-id';
const EXT_APPOINTMENT_ENCOUNTER_ID =
  'https://yosemitecrew.com/fhir/StructureDefinition/appointment-encounter-id';
const EXT_APPOINTMENT_TEMPLATE_DEFAULTS =
  'https://yosemitecrew.com/fhir/StructureDefinition/appointment-template-defaults';

const EXT_TEMPLATE_DEFAULT_KIND = 'templateKind';
const EXT_TEMPLATE_DEFAULT_ID = 'templateId';
const EXT_TEMPLATE_DEFAULT_VERSION = 'templateVersion';
const EXT_TEMPLATE_DEFAULT_SOURCE = 'source';

export function toFHIRAppointment(appointment: Appointment): FHIRAppointment {
  const participants: AppointmentParticipant[] = [];
  const normalizedLeadId = appointment.lead?.id?.trim();
  const hasValidLeadId =
    Boolean(normalizedLeadId) && normalizedLeadId !== 'undefined' && normalizedLeadId !== 'null';

  // Companion participant
  participants.push(
    {
      actor: {
        reference: `Patient/${appointment.companion.id}`,
        display: appointment.companion.name,
      },
      status: 'accepted',
    },
    {
      actor: {
        reference: `RelatedPerson/${appointment.companion.parent.id}`,
        display: appointment.companion.parent.name,
      },
      status: 'accepted',
    },
    {
      actor: {
        reference: `Organization/${appointment.organisationId}`,
      },
      status: 'accepted',
    }
  );

  if (hasValidLeadId) {
    participants.push({
      actor: {
        reference: `Practitioner/${normalizedLeadId}`,
        display: appointment.lead?.name,
      },
      status: 'accepted',
      type: [
        {
          coding: [
            {
              code: 'PPRF',
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              display: 'appointment lead',
            },
          ],
        },
      ],
      extension: appointment.lead?.profileUrl
        ? [{ url: EXT_LEAD_PROFILE_URL, valueString: appointment.lead.profileUrl }]
        : undefined,
    });
  }

  // Support staff participants
  if (appointment.supportStaff && appointment.supportStaff.length > 0) {
    for (const staff of appointment.supportStaff) {
      participants.push({
        actor: {
          reference: `Practitioner/${staff.id}`,
          display: staff.name,
        },
        status: 'accepted',
        type: [
          {
            coding: [
              {
                code: 'SPRF',
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                display: 'support performer',
              },
            ],
          },
        ],
      });
    }
  }

  // Room participant
  if (appointment.room) {
    participants.push({
      actor: {
        reference: `Location/${appointment.room.id}`,
        display: appointment.room.name,
      },
      status: 'accepted',
      type: [
        {
          coding: [
            {
              code: 'LOC',
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              display: 'location',
            },
          ],
        },
      ],
    });
  }

  // Appointment Type as serviceType
  const serviceType: CodeableConcept[] = appointment.appointmentType
    ? [
        {
          coding: [
            {
              code: appointment.appointmentType.id,
              display: appointment.appointmentType.name,
              system: 'http://example.org/appointment-types',
            },
          ],
          text: appointment.appointmentType.name,
        },
      ]
    : [];

  // Appointment speciality links to Speciality
  const specialty: CodeableConcept[] = appointment.appointmentType?.speciality
    ? [
        {
          coding: [
            {
              system: 'http://yosemitecrew.com/fhir/specialty',
              code: appointment.appointmentType.speciality.id,
              display: appointment.appointmentType.speciality.name,
            },
          ],
        },
      ]
    : [];

  const fhirStatus = appointment.status;

  const extension: Extension[] = [];

  extension.push(
    {
      id: 'species',
      url: SPECIES_SYSTEM_URL,
      valueString: appointment.companion.species,
    },
    {
      id: 'breed',
      url: BREED_SYSTEM_URL,
      valueString: appointment.companion.breed,
    }
  );

  if (appointment.isEmergency != null) {
    extension.push({
      url: EXT_EMERGENCY,
      valueBoolean: appointment.isEmergency,
    });
  }

  if (appointment.attachments?.length) {
    appointment.attachments.forEach((att) => {
      extension.push({
        url: EXT_APPOINTMENT_ATTACHMENTS,
        extension: [
          { url: 'key', valueString: att.key },
          { url: 'name', valueString: att.name },
          { url: 'contentType', valueString: att.contentType },
        ],
      });
    });
  }

  if (appointment.formIds?.length) {
    appointment.formIds.forEach((formId) => {
      if (!formId) return;
      extension.push({
        url: EXT_APPOINTMENT_FORM_IDS,
        valueString: formId,
      });
    });
  }

  if (appointment.paymentStatus) {
    extension.push({
      url: EXT_APPOINTMENT_PAYMENT_STATUS,
      valueString: appointment.paymentStatus,
    });
  }

  if (appointment.appointmentKind) {
    extension.push({
      url: EXT_APPOINTMENT_KIND,
      valueString: appointment.appointmentKind,
    });
  }

  if (appointment.caseId) {
    extension.push({
      url: EXT_APPOINTMENT_CASE_ID,
      valueString: appointment.caseId,
    });
  }

  if (appointment.encounterId) {
    extension.push({
      url: EXT_APPOINTMENT_ENCOUNTER_ID,
      valueString: appointment.encounterId,
    });
  }

  if (appointment.templateDefaults?.length) {
    appointment.templateDefaults.forEach((templateDefault) => {
      extension.push({
        url: EXT_APPOINTMENT_TEMPLATE_DEFAULTS,
        extension: [
          {
            url: EXT_TEMPLATE_DEFAULT_KIND,
            valueString: templateDefault.templateKind,
          },
          ...(templateDefault.templateId
            ? [
                {
                  url: EXT_TEMPLATE_DEFAULT_ID,
                  valueString: templateDefault.templateId,
                } as Extension,
              ]
            : []),
          ...(templateDefault.templateVersion != null
            ? [
                {
                  url: EXT_TEMPLATE_DEFAULT_VERSION,
                  valueInteger: templateDefault.templateVersion,
                } as Extension,
              ]
            : []),
          {
            url: EXT_TEMPLATE_DEFAULT_SOURCE,
            valueString: templateDefault.source,
          },
        ],
      });
    });
  }

  const fhirAppointment: FHIRAppointment = {
    resourceType: 'Appointment',
    id: appointment.id,
    status: fhirStatus,
    participant: participants,
    serviceType,
    specialty,
    start: dayjs(appointment.startTime).toISOString(),
    end: dayjs(appointment.endTime).toISOString(),
    minutesDuration: appointment.durationMinutes,
    description: appointment.concern,
    extension: extension,
  };

  return fhirAppointment;
}

export function fromFHIRAppointment(FHIRappointment: FHIRAppointment): Appointment {
  const companionParticipant = FHIRappointment.participant.find((p) =>
    p.actor?.reference?.startsWith('Patient/')
  );
  const parentParticipant = FHIRappointment.participant.find((p) =>
    p.actor?.reference?.startsWith('RelatedPerson/')
  );
  const leadParticipant = FHIRappointment.participant.find(
    (p) =>
      p.type?.some((t) => t.coding?.some((c) => c.code === 'PPRF')) &&
      p.actor?.reference?.startsWith('Practitioner/') &&
      !['undefined', 'null', ''].includes(
        (p.actor?.reference?.split('/')[1] ?? '').trim().toLowerCase()
      )
  );
  const supportStaffParticipants = FHIRappointment.participant.filter((p) =>
    p.type?.some((t) => t.coding?.some((c) => c.code === 'SPRF'))
  );
  const roomParticipant = FHIRappointment.participant.find((p) =>
    p.type?.some((t) => t.coding?.some((c) => c.code === 'LOC'))
  );
  const orgParticipant = FHIRappointment.participant.find((p) =>
    p.actor?.reference?.startsWith('Organization/')
  );

  const appointmentTypeCoding = FHIRappointment.serviceType?.[0]?.coding?.[0] || undefined;

  const specialityCoding =
    (FHIRappointment.specialty?.[0]?.coding?.[0] ||
      (FHIRappointment as FHIRAppointment & { speciality?: CodeableConcept[] }).speciality?.[0]
        ?.coding?.[0]) ??
    undefined;

  const speciesExtesnion = FHIRappointment.extension?.find((p) => p.id?.includes('species'));
  const breedExtension = FHIRappointment.extension?.find((p) => p.id?.includes('breed'));
  const emergencyExtension = FHIRappointment.extension?.find((p) => p.url === EXT_EMERGENCY);
  const leadProfileExtension = leadParticipant?.extension?.find(
    (ext) => ext.url === EXT_LEAD_PROFILE_URL
  );

  const pmsStatus = FHIRappointment.status; // fallback if unknown status
  const normalizedStatus = pmsStatus === 'NO_PAYMENT' ? 'REQUESTED' : pmsStatus;

  const attachments =
    FHIRappointment.extension
      ?.filter((ext) => ext.url === EXT_APPOINTMENT_ATTACHMENTS)
      .map((ext) => {
        const key = ext.extension?.find((e) => e.url === 'key')?.valueString || '';
        const name = ext.extension?.find((e) => e.url === 'name')?.valueString;
        const contentType = ext.extension?.find((e) => e.url === 'contentType')?.valueString;

        return { key, name, contentType };
      }) || [];

  const formIds =
    FHIRappointment.extension
      ?.filter((ext) => ext.url === EXT_APPOINTMENT_FORM_IDS)
      .map((ext) => ext.valueString!)
      .filter(Boolean) || [];

  const paymentStatus = FHIRappointment.extension?.find(
    (ext) => ext.url === EXT_APPOINTMENT_PAYMENT_STATUS
  )?.valueString as AppointmentPaymentStatus | undefined;
  const appointmentKind = FHIRappointment.extension?.find((ext) => ext.url === EXT_APPOINTMENT_KIND)
    ?.valueString as AppointmentKind | undefined;
  const caseId = FHIRappointment.extension?.find(
    (ext) => ext.url === EXT_APPOINTMENT_CASE_ID
  )?.valueString;
  const encounterId = FHIRappointment.extension?.find(
    (ext) => ext.url === EXT_APPOINTMENT_ENCOUNTER_ID
  )?.valueString;

  const templateDefaults =
    FHIRappointment.extension
      ?.filter((ext) => ext.url === EXT_APPOINTMENT_TEMPLATE_DEFAULTS)
      .map((ext) => {
        const templateKind = ext.extension?.find((item) => item.url === EXT_TEMPLATE_DEFAULT_KIND)
          ?.valueString as TemplateKind | undefined;
        const templateId = ext.extension?.find(
          (item) => item.url === EXT_TEMPLATE_DEFAULT_ID
        )?.valueString;
        const templateVersion = ext.extension?.find(
          (item) => item.url === EXT_TEMPLATE_DEFAULT_VERSION
        )?.valueInteger;
        const source = ext.extension?.find((item) => item.url === EXT_TEMPLATE_DEFAULT_SOURCE)
          ?.valueString as AppointmentTemplateDefault['source'] | undefined;

        if (!templateKind || !source) {
          return null;
        }

        return {
          templateKind,
          templateId,
          templateVersion,
          source,
        };
      })
      .filter((value): value is AppointmentTemplateDefault => value !== null) || [];

  // Construct internal Appointment object
  const leadId = leadParticipant?.actor?.reference?.split('/')[1] ?? '';
  const hasLead =
    leadId.trim().length > 0 &&
    leadId.trim().toLowerCase() !== 'undefined' &&
    leadId.trim().toLowerCase() !== 'null';

  const appointment: Appointment = {
    id: FHIRappointment.id ?? '',
    caseId: caseId || undefined,
    encounterId: encounterId || undefined,
    organisationId: orgParticipant?.actor?.reference?.split('/')[1] ?? 'unknown-org',
    companion: {
      id: companionParticipant?.actor?.reference?.split('/')[1] ?? 'unknown-pet',
      name: companionParticipant?.actor?.display ?? '',
      species: speciesExtesnion?.valueString || '',
      breed: breedExtension?.valueString || '',
      parent: {
        id: parentParticipant?.actor?.reference?.split('/')[1] ?? 'unknown-owner',
        name: parentParticipant?.actor?.display ?? '',
      },
    },
    lead: hasLead
      ? {
          id: leadId,
          name: leadParticipant?.actor?.display ?? '',
          profileUrl: leadProfileExtension?.valueString,
        }
      : undefined,
    supportStaff: supportStaffParticipants.map((s) => ({
      id: s.actor?.reference?.split('/')[1] ?? '',
      name: s.actor?.display ?? '',
    })),
    room: roomParticipant
      ? {
          id: roomParticipant.actor?.reference?.split('/')[1] ?? '',
          name: roomParticipant.actor?.display ?? '',
        }
      : undefined,
    appointmentDate: FHIRappointment.start ? new Date(FHIRappointment.start) : new Date(),
    timeSlot: dayjs(FHIRappointment.start).format('HH:mm'),
    durationMinutes: FHIRappointment.minutesDuration ?? 0,
    startTime: FHIRappointment.start ? new Date(FHIRappointment.start) : new Date(),
    endTime: FHIRappointment.end ? new Date(FHIRappointment.end) : new Date(),
    status: normalizedStatus as any,
    paymentStatus,
    concern: FHIRappointment.description ?? '',
    createdAt: FHIRappointment.created ? new Date(FHIRappointment.created) : new Date(),
    updatedAt: new Date(),
    appointmentType: {
      id: appointmentTypeCoding?.code ?? 'general',
      name: appointmentTypeCoding?.display ?? 'General Appointment',
      speciality: {
        id: specialityCoding?.code || '',
        name: specialityCoding?.display || '',
      },
    },
    appointmentKind: appointmentKind ?? 'OUTPATIENT',
    isEmergency: emergencyExtension?.valueBoolean,
    attachments,
    formIds,
    templateDefaults,
  };

  return appointment;
}
