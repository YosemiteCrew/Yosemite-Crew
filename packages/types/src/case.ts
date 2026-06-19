import type { EpisodeOfCare, Extension } from '@yosemite-crew/fhir';
import type { AppointmentKind } from './catalog';

export const CASE_STATUSES = [
  'planned',
  'waitlist',
  'active',
  'onhold',
  'finished',
  'cancelled',
  'entered-in-error',
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export type Case = {
  id?: string;
  organisationId: string;
  patientId?: string;
  companionId?: string;
  parentId?: string;
  status: CaseStatus;
  appointmentKind: AppointmentKind;
  title?: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

const EXT_CASE_PARENT_ID = 'https://yosemitecrew.com/fhir/StructureDefinition/case-parent-id';
const EXT_CASE_APPOINTMENT_KIND =
  'https://yosemitecrew.com/fhir/StructureDefinition/case-appointment-kind';
const EXT_CASE_TITLE = 'https://yosemitecrew.com/fhir/StructureDefinition/case-title';
const EXT_CASE_DESCRIPTION = 'https://yosemitecrew.com/fhir/StructureDefinition/case-description';

const getStringExtension = (extensions: Extension[] | undefined, url: string): string | undefined =>
  extensions?.find((extension) => extension.url === url)?.valueString ?? undefined;

export const toFHIRCase = (value: Case): EpisodeOfCare => {
  const extension: Extension[] = [
    {
      url: EXT_CASE_APPOINTMENT_KIND,
      valueString: value.appointmentKind,
    },
  ];

  if (value.parentId) {
    extension.push({
      url: EXT_CASE_PARENT_ID,
      valueString: value.parentId,
    });
  }

  if (value.title) {
    extension.push({
      url: EXT_CASE_TITLE,
      valueString: value.title,
    });
  }

  if (value.description) {
    extension.push({
      url: EXT_CASE_DESCRIPTION,
      valueString: value.description,
    });
  }

  return {
    resourceType: 'EpisodeOfCare',
    id: value.id,
    status: value.status,
    patient: {
      reference: `Patient/${value.patientId ?? value.companionId ?? ''}`,
    },
    managingOrganization: {
      reference: `Organization/${value.organisationId}`,
    },
    extension,
  };
};

export const fromFHIRCase = (resource: EpisodeOfCare): Case => {
  const patientReference = resource.patient?.reference ?? '';
  const organisationReference = resource.managingOrganization?.reference ?? '';

  return {
    id: resource.id,
    organisationId: organisationReference.replace(/^Organization\//, ''),
    patientId: patientReference.replace(/^Patient\//, ''),
    companionId: patientReference.replace(/^Patient\//, ''),
    parentId: getStringExtension(resource.extension, EXT_CASE_PARENT_ID),
    status: (resource.status ?? 'planned') as CaseStatus,
    appointmentKind:
      (getStringExtension(resource.extension, EXT_CASE_APPOINTMENT_KIND) as
        | AppointmentKind
        | undefined) ?? 'OUTPATIENT',
    title: getStringExtension(resource.extension, EXT_CASE_TITLE),
    description: getStringExtension(resource.extension, EXT_CASE_DESCRIPTION),
  };
};
