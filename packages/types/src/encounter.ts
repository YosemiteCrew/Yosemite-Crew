import type { Coding, Encounter as FHIREncounter, Extension } from '@yosemite-crew/fhir';
import type { Admission } from './admission';
import type { AppointmentKind } from './catalog';

export const ENCOUNTER_STATUSES = [
  'planned',
  'arrived',
  'triaged',
  'in-progress',
  'onleave',
  'finished',
  'cancelled',
] as const;

export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

export type EncounterClass = 'AMB' | 'IMP' | 'EMER' | 'OBSENC' | 'VR';

export type Encounter = {
  id?: string;
  caseId: string;
  appointmentId?: string;
  organisationId: string;
  patientId?: string;
  companionId?: string;
  parentId?: string;
  status: EncounterStatus;
  encounterClass: EncounterClass;
  appointmentKind: AppointmentKind;
  title?: string;
  reason?: string;
  periodStart?: Date;
  periodEnd?: Date;
  admission?: Admission;
  createdAt?: Date;
  updatedAt?: Date;
};

const EXT_ENCOUNTER_PARENT_ID =
  'https://yosemitecrew.com/fhir/StructureDefinition/encounter-parent-id';
const EXT_ENCOUNTER_APPOINTMENT_KIND =
  'https://yosemitecrew.com/fhir/StructureDefinition/encounter-appointment-kind';
const EXT_ENCOUNTER_TITLE = 'https://yosemitecrew.com/fhir/StructureDefinition/encounter-title';
const EXT_ADMISSION_UNIT_ID = 'https://yosemitecrew.com/fhir/StructureDefinition/admission-unit-id';
const EXT_ADMISSION_EXPECTED_STAY_DAYS =
  'https://yosemitecrew.com/fhir/StructureDefinition/admission-expected-stay-days';

const getStringExtension = (extensions: Extension[] | undefined, url: string): string | undefined =>
  extensions?.find((extension) => extension.url === url)?.valueString ?? undefined;

const toEncounterClassCoding = (value: EncounterClass): Coding => ({
  system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  code: value,
});

export const toFHIREncounter = (value: Encounter): FHIREncounter => {
  const extension: Extension[] = [
    {
      url: EXT_ENCOUNTER_APPOINTMENT_KIND,
      valueString: value.appointmentKind,
    },
  ];

  if (value.parentId) {
    extension.push({
      url: EXT_ENCOUNTER_PARENT_ID,
      valueString: value.parentId,
    });
  }

  if (value.title) {
    extension.push({
      url: EXT_ENCOUNTER_TITLE,
      valueString: value.title,
    });
  }

  const hospitalization =
    value.admission || value.appointmentKind === 'INPATIENT'
      ? {
          extension: [
            ...(value.admission?.unitId
              ? [
                  {
                    url: EXT_ADMISSION_UNIT_ID,
                    valueString: value.admission.unitId,
                  },
                ]
              : []),
            ...(typeof value.admission?.expectedStayDays === 'number'
              ? [
                  {
                    url: EXT_ADMISSION_EXPECTED_STAY_DAYS,
                    valueInteger: value.admission.expectedStayDays,
                  },
                ]
              : []),
          ],
        }
      : undefined;

  return {
    resourceType: 'Encounter',
    id: value.id,
    status: value.status,
    class: toEncounterClassCoding(value.encounterClass),
    subject: {
      reference: `Patient/${value.patientId ?? value.companionId ?? ''}`,
    },
    episodeOfCare: [
      {
        reference: `EpisodeOfCare/${value.caseId}`,
      },
    ],
    appointment: value.appointmentId
      ? [
          {
            reference: `Appointment/${value.appointmentId}`,
          },
        ]
      : undefined,
    serviceProvider: {
      reference: `Organization/${value.organisationId}`,
    },
    period:
      value.periodStart || value.periodEnd
        ? {
            start: value.periodStart?.toISOString(),
            end: value.periodEnd?.toISOString(),
          }
        : undefined,
    reasonCode: value.reason
      ? [
          {
            text: value.reason,
          },
        ]
      : undefined,
    hospitalization,
    extension,
  };
};

export const fromFHIREncounter = (resource: FHIREncounter): Encounter => {
  const episodeReference = resource.episodeOfCare?.[0]?.reference ?? '';
  const patientReference = resource.subject?.reference ?? '';
  const organisationReference = resource.serviceProvider?.reference ?? '';
  const appointmentReference = resource.appointment?.[0]?.reference ?? '';

  return {
    id: resource.id,
    caseId: episodeReference.replace(/^EpisodeOfCare\//, ''),
    appointmentId: appointmentReference
      ? appointmentReference.replace(/^Appointment\//, '')
      : undefined,
    organisationId: organisationReference.replace(/^Organization\//, ''),
    patientId: patientReference.replace(/^Patient\//, ''),
    companionId: patientReference.replace(/^Patient\//, ''),
    parentId: getStringExtension(resource.extension, EXT_ENCOUNTER_PARENT_ID),
    status: (resource.status ?? 'planned') as EncounterStatus,
    encounterClass: (resource.class?.code ?? 'AMB') as EncounterClass,
    appointmentKind:
      (getStringExtension(resource.extension, EXT_ENCOUNTER_APPOINTMENT_KIND) as
        | AppointmentKind
        | undefined) ?? 'OUTPATIENT',
    title: getStringExtension(resource.extension, EXT_ENCOUNTER_TITLE),
    reason: resource.reasonCode?.[0]?.text ?? undefined,
    periodStart: resource.period?.start ? new Date(resource.period.start) : undefined,
    periodEnd: resource.period?.end ? new Date(resource.period.end) : undefined,
  };
};
