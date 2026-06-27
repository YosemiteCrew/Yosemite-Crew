import type {
  Bundle,
  CodeableConcept,
  Composition,
  Extension,
  Immunization,
  MedicationRequest,
  Observation,
  Procedure,
  Reference,
} from '@yosemite-crew/fhir';

export type ClinicalArtifactKind =
  | 'SOAP_NOTE'
  | 'PRESCRIPTION'
  | 'DISCHARGE_SUMMARY'
  | 'VITAL_RECORD'
  | 'IMMUNIZATION'
  | 'RABIES_TITRATION'
  | 'PARASITE_TREATMENT'
  | 'CLINICAL_EXAM';

export type ClinicalArtifactStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'SIGNED' | 'VOID';

export type ClinicalArtifactBaseInput = {
  organisationId: string;
  appointmentId?: string;
  caseId?: string;
  encounterId?: string;
  templateId?: string;
  templateVersion?: number;
  templateVersionId?: string;
  authorId?: string;
  status?: ClinicalArtifactStatus;
  summary?: string | null;
};

export type SoapNoteInput = ClinicalArtifactBaseInput & {
  subjective?: unknown;
  objective?: unknown;
  assessment?: unknown;
  plan?: unknown;
  diagnoses?: unknown;
  metadata?: unknown;
};

export type SoapNoteRecord = {
  artifact: {
    id: string;
    organisationId: string;
    appointmentId: string | null;
    caseId: string | null;
    encounterId: string | null;
    kind: ClinicalArtifactKind;
    status: ClinicalArtifactStatus;
    templateId: string | null;
    templateVersion: number | null;
    templateVersionId: string | null;
    authorId: string | null;
    signedBy: string | null;
    signedAt: Date | null;
    summary: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  soapNote: {
    id: string;
    artifactId: string;
    subjective: unknown;
    objective: unknown;
    assessment: unknown;
    plan: unknown;
    diagnoses: unknown;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type PrescriptionInput = ClinicalArtifactBaseInput & {
  medications?: unknown;
  instructions?: unknown;
  notes?: unknown;
  metadata?: unknown;
};

export type PrescriptionRecord = {
  artifact: SoapNoteRecord['artifact'] & {
    kind: 'PRESCRIPTION';
  };
  prescription: {
    id: string;
    artifactId: string;
    medications: unknown;
    instructions: unknown;
    notes: unknown;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type DischargeSummaryInput = ClinicalArtifactBaseInput & {
  summaryContent?: unknown;
  diagnoses?: unknown;
  medications?: unknown;
  followUp?: unknown;
  instructions?: unknown;
  metadata?: unknown;
};

export type DischargeSummaryRecord = {
  artifact: SoapNoteRecord['artifact'] & {
    kind: 'DISCHARGE_SUMMARY';
  };
  dischargeSummary: {
    id: string;
    artifactId: string;
    summary: unknown;
    diagnoses: unknown;
    medications: unknown;
    followUp: unknown;
    instructions: unknown;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type VitalRecordInput = ClinicalArtifactBaseInput & {
  measuredAt: Date | string;
  recordedBy?: string | null;
  recordedByDisplay?: string | null;
  vitals: unknown;
  notes?: unknown;
  metadata?: unknown;
};

export type VitalRecordRecord = {
  artifact: SoapNoteRecord['artifact'] & {
    kind: 'VITAL_RECORD';
  };
  vitalRecord: {
    id: string;
    artifactId: string;
    measuredAt: Date;
    recordedBy: string | null;
    recordedByDisplay?: string | null;
    vitals: unknown;
    notes: unknown;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type ImmunizationRecord = {
  artifact: SoapNoteRecord['artifact'] & {
    kind: 'IMMUNIZATION';
  };
  immunization: {
    id: string;
    artifactId: string;
    vaccineType: string;
    vaccineName: string;
    manufacturer: string | null;
    batchNumber: string | null;
    lotNumber: string | null;
    dateAdministered: Date;
    validFrom: Date | null;
    validUntil: Date | null;
    nextDueDate: Date | null;
    site: string | null;
    route: string | null;
    notes: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type RabiesTitrationRecord = {
  artifact: SoapNoteRecord['artifact'] & {
    kind: 'RABIES_TITRATION';
  };
  rabiesTitration: {
    id: string;
    artifactId: string;
    approvedLab: string;
    sampleDate: Date;
    resultIuMl: number;
    reportUrl: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type ParasiteTreatmentRecord = {
  artifact: SoapNoteRecord['artifact'] & {
    kind: 'PARASITE_TREATMENT';
  };
  parasiteTreatment: {
    id: string;
    artifactId: string;
    treatmentType: string;
    productName: string;
    manufacturer: string | null;
    treatedAt: Date;
    notes: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type ClinicalExaminationRecord = {
  artifact: SoapNoteRecord['artifact'] & {
    kind: 'CLINICAL_EXAM';
  };
  clinicalExamination: {
    id: string;
    artifactId: string;
    examinedAt: Date;
    fitForTravel: boolean;
    findings: string | null;
    weightKg: number | null;
    temperatureC: number | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type ClinicalArtifactRecordLike =
  | SoapNoteRecord
  | PrescriptionRecord
  | DischargeSummaryRecord
  | VitalRecordRecord
  | ImmunizationRecord
  | RabiesTitrationRecord
  | ParasiteTreatmentRecord
  | ClinicalExaminationRecord;

export type ClinicalArtifactFhirInputDefaults = {
  organisationId: string;
  appointmentId?: string;
  caseId?: string;
  encounterId?: string;
  authorId?: string;
  templateId?: string;
  templateVersion?: number;
  templateVersionId?: string;
  recordedBy?: string | null;
  recordedByDisplay?: string | null;
};

const SOAP_SUBJECTIVE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-subjective';
const SOAP_OBJECTIVE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-objective';
const SOAP_ASSESSMENT_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-assessment';
const SOAP_PLAN_EXTENSION_URL = 'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-plan';
const SOAP_DIAGNOSES_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-diagnoses';
const SOAP_METADATA_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-metadata';

const PRESCRIPTION_MEDICATIONS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/prescription-medications';
const PRESCRIPTION_INSTRUCTIONS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/prescription-instructions';
const PRESCRIPTION_NOTES_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/prescription-notes';
const PRESCRIPTION_METADATA_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/prescription-metadata';

const DISCHARGE_SUMMARY_CONTENT_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-content';
const DISCHARGE_SUMMARY_DIAGNOSES_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-diagnoses';
const DISCHARGE_SUMMARY_MEDICATIONS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-medications';
const DISCHARGE_SUMMARY_FOLLOW_UP_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-follow-up';
const DISCHARGE_SUMMARY_INSTRUCTIONS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-instructions';
const DISCHARGE_SUMMARY_METADATA_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-metadata';

const VITALS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/vital-record-vitals';
const VITALS_NOTES_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/vital-record-notes';
const VITALS_METADATA_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/vital-record-metadata';

const IMMUNIZATION_VACCINE_TYPE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/immunization-vaccine-type';
const IMMUNIZATION_BATCH_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/immunization-batch-number';
const IMMUNIZATION_VALID_FROM_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/immunization-valid-from';
const IMMUNIZATION_VALID_UNTIL_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/immunization-valid-until';
const IMMUNIZATION_NEXT_DUE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/immunization-next-due';
const IMMUNIZATION_METADATA_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/immunization-metadata';

const TITRATION_REPORT_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/rabies-titration-report';
const TITRATION_METADATA_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/rabies-titration-metadata';

const PARASITE_MANUFACTURER_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/parasite-treatment-manufacturer';
const PARASITE_METADATA_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/parasite-treatment-metadata';

const EXAM_FIT_FOR_TRAVEL_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/clinical-exam-fit-for-travel';
const EXAM_FINDINGS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/clinical-exam-findings';
const EXAM_WEIGHT_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/clinical-exam-weight-kg';
const EXAM_TEMPERATURE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/clinical-exam-temperature-c';
const EXAM_METADATA_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/clinical-exam-metadata';

const RABIES_TITRE_ADEQUATE_THRESHOLD = 0.5;

const toIso = (value: Date | string | null | undefined) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const toReference = (reference?: string | null): Reference | undefined =>
  reference ? { reference } : undefined;

const clinicalContextReference = (artifact: {
  encounterId: string | null;
  appointmentId: string | null;
}) => {
  if (artifact.encounterId) return `Encounter/${artifact.encounterId}`;
  if (artifact.appointmentId) return `Appointment/${artifact.appointmentId}`;
  return undefined;
};

const toCodeableConcept = (code: string, display: string): CodeableConcept => ({
  coding: [
    {
      system: 'https://yosemitecrew.com/fhir/CodeSystem/clinical-artifact-kind',
      code,
      display,
    },
  ],
  text: display,
});

const toStatus = (status: string): string => {
  switch (status) {
    case 'SIGNED':
    case 'COMPLETED':
      return 'final';
    case 'IN_PROGRESS':
      return 'preliminary';
    case 'VOID':
      return 'entered-in-error';
    default:
      return 'preliminary';
  }
};

const toTaskStatus = (status: string): string => {
  switch (status) {
    case 'SIGNED':
    case 'COMPLETED':
      return 'active';
    case 'IN_PROGRESS':
      return 'accepted';
    case 'VOID':
      return 'cancelled';
    default:
      return 'draft';
  }
};

const toImmunizationStatus = (status: string): string =>
  status === 'VOID' ? 'entered-in-error' : 'completed';

const toProcedureStatus = (status: string): string => {
  switch (status) {
    case 'SIGNED':
    case 'COMPLETED':
      return 'completed';
    case 'IN_PROGRESS':
      return 'in-progress';
    case 'VOID':
      return 'entered-in-error';
    default:
      return 'preparation';
  }
};

const toClinicalArtifactStatus = (status?: string): ClinicalArtifactStatus => {
  switch (status) {
    case 'final':
    case 'active':
      return 'COMPLETED';
    case 'preliminary':
    // 'accepted'/'in-progress' are emitted by toTaskStatus for IN_PROGRESS prescriptions; keep round-trips in progress.
    case 'accepted':
    case 'in-progress':
      return 'IN_PROGRESS';
    case 'draft':
      return 'DRAFT';
    case 'amended':
    case 'corrected':
      return 'SIGNED';
    case 'entered-in-error':
    case 'cancelled':
      return 'VOID';
    default:
      return 'DRAFT';
  }
};

const stringifyMaybe = (value: unknown) => {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '[object]';
  }
};

const parseFlexibleJson = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const getExtensionValue = (extensions: Extension[] | undefined, url: string): unknown => {
  const extension = extensions?.find((item) => item.url === url);
  if (!extension) return undefined;
  return (
    extension.valueString ??
    extension.valueBoolean ??
    extension.valueInteger ??
    extension.valueDecimal ??
    extension.valueDateTime ??
    extension.valueDate ??
    extension.valueCode ??
    extension.valueUri ??
    extension.valueUrl ??
    extension.valueInstant ??
    extension.valueId ??
    extension.valueMarkdown ??
    extension.valueUuid ??
    extension.valueCanonical ??
    extension.valueReference ??
    undefined
  );
};

const buildJsonExtension = (url: string, value: unknown): Extension | null => {
  if (value === undefined) return null;
  return { url, valueString: stringifyMaybe(value) };
};

const buildCompositionExtensions = (
  record: SoapNoteRecord | DischargeSummaryRecord,
  fields: Record<string, unknown>
): Extension[] =>
  Object.entries(fields)
    .map(([url, value]) => buildJsonExtension(url, value))
    .filter((value): value is Extension => value !== null)
    .concat([
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-id',
        valueString: record.artifact.id,
      },
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-kind',
        valueString: record.artifact.kind,
      },
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-status',
        valueString: record.artifact.status,
      },
    ]);

const buildPrescriptionExtensions = (
  record: PrescriptionRecord,
  fields: Record<string, unknown>
): Extension[] =>
  Object.entries(fields)
    .map(([url, value]) => buildJsonExtension(url, value))
    .filter((value): value is Extension => value !== null)
    .concat([
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-id',
        valueString: record.artifact.id,
      },
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-kind',
        valueString: record.artifact.kind,
      },
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-status',
        valueString: record.artifact.status,
      },
    ]);

const buildObservationExtensions = (
  record: VitalRecordRecord,
  fields: Record<string, unknown>
): Extension[] =>
  Object.entries(fields)
    .map(([url, value]) => buildJsonExtension(url, value))
    .filter((value): value is Extension => value !== null)
    .concat([
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-id',
        valueString: record.artifact.id,
      },
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-kind',
        valueString: record.artifact.kind,
      },
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-status',
        valueString: record.artifact.status,
      },
    ]);

const recordBundle = <T extends { artifact: { id: string } }>(
  records: T[],
  toResource: (record: T) => unknown
): Bundle => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: records.length,
  entry: records.map((record) => ({
    fullUrl: `urn:uuid:${record.artifact.id}`,
    resource: toResource(record) as never,
  })),
});

const soapNoteToComposition = (record: SoapNoteRecord): Composition => ({
  resourceType: 'Composition',
  id: record.artifact.id,
  status: toStatus(record.artifact.status),
  type: toCodeableConcept('SOAP_NOTE', 'SOAP note'),
  title: record.artifact.summary ?? 'SOAP note',
  date: toIso(record.artifact.updatedAt) ?? new Date().toISOString(),
  author: [
    record.artifact.authorId
      ? { reference: `Practitioner/${record.artifact.authorId}` }
      : { display: 'System' },
  ],
  encounter: toReference(clinicalContextReference(record.artifact)),
  extension: buildCompositionExtensions(record, {
    [SOAP_SUBJECTIVE_EXTENSION_URL]: record.soapNote.subjective,
    [SOAP_OBJECTIVE_EXTENSION_URL]: record.soapNote.objective,
    [SOAP_ASSESSMENT_EXTENSION_URL]: record.soapNote.assessment,
    [SOAP_PLAN_EXTENSION_URL]: record.soapNote.plan,
    [SOAP_DIAGNOSES_EXTENSION_URL]: record.soapNote.diagnoses,
    [SOAP_METADATA_EXTENSION_URL]: record.soapNote.metadata,
  }),
});

const compositionToSoapNoteInput = (
  resource: Composition,
  defaults: ClinicalArtifactFhirInputDefaults
): SoapNoteInput => ({
  organisationId: defaults.organisationId,
  appointmentId: defaults.appointmentId,
  caseId: defaults.caseId,
  encounterId: defaults.encounterId,
  authorId: defaults.authorId,
  templateId: defaults.templateId,
  templateVersion: defaults.templateVersion,
  templateVersionId: defaults.templateVersionId,
  status: toClinicalArtifactStatus(resource.status),
  summary: resource.title,
  subjective: parseFlexibleJson(
    getExtensionValue(resource.extension, SOAP_SUBJECTIVE_EXTENSION_URL)
  ),
  objective: parseFlexibleJson(getExtensionValue(resource.extension, SOAP_OBJECTIVE_EXTENSION_URL)),
  assessment: parseFlexibleJson(
    getExtensionValue(resource.extension, SOAP_ASSESSMENT_EXTENSION_URL)
  ),
  plan: parseFlexibleJson(getExtensionValue(resource.extension, SOAP_PLAN_EXTENSION_URL)),
  diagnoses: parseFlexibleJson(getExtensionValue(resource.extension, SOAP_DIAGNOSES_EXTENSION_URL)),
  metadata: parseFlexibleJson(getExtensionValue(resource.extension, SOAP_METADATA_EXTENSION_URL)),
});

const prescriptionToMedicationRequest = (record: PrescriptionRecord): MedicationRequest => ({
  resourceType: 'MedicationRequest',
  id: record.artifact.id,
  status: toTaskStatus(record.artifact.status),
  intent: 'order',
  medicationCodeableConcept: toCodeableConcept('PRESCRIPTION', 'Prescription'),
  medicationReference: { reference: `MedicationRequest/${record.artifact.id}` },
  subject: {
    reference: clinicalContextReference(record.artifact) ?? `Task/${record.artifact.id}`,
  },
  encounter: toReference(clinicalContextReference(record.artifact)),
  authoredOn: toIso(record.artifact.updatedAt) ?? new Date().toISOString(),
  requester: record.artifact.authorId
    ? { reference: `Practitioner/${record.artifact.authorId}` }
    : undefined,
  note:
    typeof record.prescription.notes === 'string'
      ? [{ text: record.prescription.notes }]
      : undefined,
  dosageInstruction:
    typeof record.prescription.instructions === 'string'
      ? [{ text: record.prescription.instructions }]
      : undefined,
  extension: buildPrescriptionExtensions(record, {
    [PRESCRIPTION_MEDICATIONS_EXTENSION_URL]: record.prescription.medications,
    [PRESCRIPTION_INSTRUCTIONS_EXTENSION_URL]: record.prescription.instructions,
    [PRESCRIPTION_NOTES_EXTENSION_URL]: record.prescription.notes,
    [PRESCRIPTION_METADATA_EXTENSION_URL]: record.prescription.metadata,
  }),
});

const medicationRequestToPrescriptionInput = (
  resource: MedicationRequest,
  defaults: ClinicalArtifactFhirInputDefaults
): PrescriptionInput => {
  const metadata = parseFlexibleJson(
    getExtensionValue(resource.extension, PRESCRIPTION_METADATA_EXTENSION_URL)
  );
  const metadataRecord =
    metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  const readStringField = (key: string): string | undefined => {
    const value = metadataRecord[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };

  return {
    organisationId: defaults.organisationId,
    appointmentId: defaults.appointmentId,
    caseId: defaults.caseId,
    encounterId: defaults.encounterId,
    authorId: defaults.authorId,
    templateId: defaults.templateId,
    templateVersion: defaults.templateVersion,
    templateVersionId: defaults.templateVersionId,
    status: toClinicalArtifactStatus(resource.status),
    summary: resource.medicationCodeableConcept?.text,
    medications: parseFlexibleJson(
      getExtensionValue(resource.extension, PRESCRIPTION_MEDICATIONS_EXTENSION_URL)
    ),
    instructions: parseFlexibleJson(
      getExtensionValue(resource.extension, PRESCRIPTION_INSTRUCTIONS_EXTENSION_URL)
    ),
    notes: parseFlexibleJson(
      getExtensionValue(resource.extension, PRESCRIPTION_NOTES_EXTENSION_URL)
    ),
    metadata,
  };
};

const dischargeSummaryToComposition = (record: DischargeSummaryRecord): Composition => ({
  resourceType: 'Composition',
  id: record.artifact.id,
  status: toStatus(record.artifact.status),
  type: toCodeableConcept('DISCHARGE_SUMMARY', 'Discharge summary'),
  title: record.artifact.summary ?? 'Discharge summary',
  date: toIso(record.artifact.updatedAt) ?? new Date().toISOString(),
  author: [
    record.artifact.authorId
      ? { reference: `Practitioner/${record.artifact.authorId}` }
      : { display: 'System' },
  ],
  encounter: toReference(clinicalContextReference(record.artifact)),
  extension: buildCompositionExtensions(record, {
    [DISCHARGE_SUMMARY_CONTENT_EXTENSION_URL]: record.dischargeSummary.summary,
    [DISCHARGE_SUMMARY_DIAGNOSES_EXTENSION_URL]: record.dischargeSummary.diagnoses,
    [DISCHARGE_SUMMARY_MEDICATIONS_EXTENSION_URL]: record.dischargeSummary.medications,
    [DISCHARGE_SUMMARY_FOLLOW_UP_EXTENSION_URL]: record.dischargeSummary.followUp,
    [DISCHARGE_SUMMARY_INSTRUCTIONS_EXTENSION_URL]: record.dischargeSummary.instructions,
    [DISCHARGE_SUMMARY_METADATA_EXTENSION_URL]: record.dischargeSummary.metadata,
  }),
});

const compositionToDischargeSummaryInput = (
  resource: Composition,
  defaults: ClinicalArtifactFhirInputDefaults
): DischargeSummaryInput => ({
  organisationId: defaults.organisationId,
  appointmentId: defaults.appointmentId,
  caseId: defaults.caseId,
  encounterId: defaults.encounterId,
  authorId: defaults.authorId,
  templateId: defaults.templateId,
  templateVersion: defaults.templateVersion,
  templateVersionId: defaults.templateVersionId,
  status: toClinicalArtifactStatus(resource.status),
  summary: resource.title,
  summaryContent: parseFlexibleJson(
    getExtensionValue(resource.extension, DISCHARGE_SUMMARY_CONTENT_EXTENSION_URL)
  ),
  diagnoses: parseFlexibleJson(
    getExtensionValue(resource.extension, DISCHARGE_SUMMARY_DIAGNOSES_EXTENSION_URL)
  ),
  medications: parseFlexibleJson(
    getExtensionValue(resource.extension, DISCHARGE_SUMMARY_MEDICATIONS_EXTENSION_URL)
  ),
  followUp: parseFlexibleJson(
    getExtensionValue(resource.extension, DISCHARGE_SUMMARY_FOLLOW_UP_EXTENSION_URL)
  ),
  instructions: parseFlexibleJson(
    getExtensionValue(resource.extension, DISCHARGE_SUMMARY_INSTRUCTIONS_EXTENSION_URL)
  ),
  metadata: parseFlexibleJson(
    getExtensionValue(resource.extension, DISCHARGE_SUMMARY_METADATA_EXTENSION_URL)
  ),
});

const vitalRecordToObservation = (record: VitalRecordRecord): Observation => {
  const vitalsValue = record.vitalRecord.vitals;
  const component =
    vitalsValue && typeof vitalsValue === 'object' && !Array.isArray(vitalsValue)
      ? Object.entries(vitalsValue as Record<string, unknown>).map(([key, value]) => ({
          code: toCodeableConcept(key, key),
          ...(typeof value === 'number'
            ? { valueDecimal: value }
            : typeof value === 'boolean'
              ? { valueBoolean: value }
              : typeof value === 'string'
                ? { valueString: value }
                : { valueString: stringifyMaybe(value) ?? '' }),
        }))
      : undefined;

  return {
    resourceType: 'Observation',
    id: record.artifact.id,
    status: toStatus(record.artifact.status),
    code: toCodeableConcept('VITAL_RECORD', 'Vital record'),
    subject: toReference(clinicalContextReference(record.artifact)),
    encounter: toReference(clinicalContextReference(record.artifact)),
    effectiveDateTime: toIso(record.vitalRecord.measuredAt),
    performer: record.vitalRecord.recordedBy
      ? [
          {
            reference: `Practitioner/${record.vitalRecord.recordedBy}`,
            display: record.vitalRecord.recordedByDisplay ?? undefined,
          },
        ]
      : undefined,
    note:
      typeof record.vitalRecord.notes === 'string'
        ? [{ text: record.vitalRecord.notes }]
        : undefined,
    component,
    extension: buildObservationExtensions(record, {
      [VITALS_EXTENSION_URL]: record.vitalRecord.vitals,
      [VITALS_NOTES_EXTENSION_URL]: record.vitalRecord.notes,
      [VITALS_METADATA_EXTENSION_URL]: record.vitalRecord.metadata,
    }),
  };
};

const observationToVitalRecordInput = (
  resource: Observation,
  defaults: ClinicalArtifactFhirInputDefaults
): VitalRecordInput => ({
  organisationId: defaults.organisationId,
  appointmentId: defaults.appointmentId,
  caseId: defaults.caseId,
  encounterId: defaults.encounterId,
  authorId: defaults.authorId,
  recordedBy: defaults.recordedBy,
  recordedByDisplay:
    typeof resource.performer === 'object' &&
    Array.isArray(resource.performer) &&
    typeof resource.performer[0] === 'object' &&
    resource.performer[0] !== null &&
    typeof (resource.performer[0] as { display?: unknown }).display === 'string'
      ? String((resource.performer[0] as { display: string }).display).trim()
      : defaults.recordedByDisplay,
  templateId: defaults.templateId,
  templateVersion: defaults.templateVersion,
  templateVersionId: defaults.templateVersionId,
  status: toClinicalArtifactStatus(resource.status),
  summary: resource.code?.text,
  measuredAt: resource.effectiveDateTime ?? new Date().toISOString(),
  vitals: parseFlexibleJson(getExtensionValue(resource.extension, VITALS_EXTENSION_URL)),
  notes: parseFlexibleJson(getExtensionValue(resource.extension, VITALS_NOTES_EXTENSION_URL)),
  metadata: parseFlexibleJson(getExtensionValue(resource.extension, VITALS_METADATA_EXTENSION_URL)),
});

const buildKindExtensions = (
  artifact: {
    id: string;
    kind: ClinicalArtifactKind;
    status: ClinicalArtifactStatus;
  },
  fields: Record<string, unknown>,
  extra: Extension[] = []
): Extension[] =>
  Object.entries(fields)
    .map(([url, value]) => buildJsonExtension(url, value))
    .filter((value): value is Extension => value !== null)
    .concat(extra)
    .concat([
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-id',
        valueString: artifact.id,
      },
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-kind',
        valueString: artifact.kind,
      },
      {
        url: 'https://yosemitecrew.com/fhir/StructureDefinition/clinical-artifact-status',
        valueString: artifact.status,
      },
    ]);

const immunizationToImmunization = (record: ImmunizationRecord): Immunization => {
  const occurrence = toIso(record.immunization.dateAdministered) ?? new Date().toISOString();
  return {
    resourceType: 'Immunization',
    id: record.artifact.id,
    status: toImmunizationStatus(record.artifact.status),
    vaccineCode: toCodeableConcept(
      record.immunization.vaccineType,
      record.immunization.vaccineName
    ),
    patient: {
      reference: clinicalContextReference(record.artifact) ?? `Immunization/${record.artifact.id}`,
    },
    occurrenceDateTime: occurrence,
    occurrenceString: occurrence,
    primarySource: Boolean(record.artifact.encounterId),
    lotNumber: record.immunization.lotNumber ?? record.immunization.batchNumber ?? undefined,
    manufacturer: record.immunization.manufacturer
      ? { display: record.immunization.manufacturer }
      : undefined,
    site: record.immunization.site
      ? toCodeableConcept('site', record.immunization.site)
      : undefined,
    route: record.immunization.route
      ? toCodeableConcept('route', record.immunization.route)
      : undefined,
    encounter: toReference(clinicalContextReference(record.artifact)),
    note:
      typeof record.immunization.notes === 'string'
        ? [{ text: record.immunization.notes }]
        : undefined,
    extension: buildKindExtensions(record.artifact, {
      [IMMUNIZATION_VACCINE_TYPE_EXTENSION_URL]: record.immunization.vaccineType,
      [IMMUNIZATION_BATCH_EXTENSION_URL]: record.immunization.batchNumber ?? undefined,
      [IMMUNIZATION_VALID_FROM_EXTENSION_URL]: toIso(record.immunization.validFrom),
      [IMMUNIZATION_VALID_UNTIL_EXTENSION_URL]: toIso(record.immunization.validUntil),
      [IMMUNIZATION_NEXT_DUE_EXTENSION_URL]: toIso(record.immunization.nextDueDate),
      [IMMUNIZATION_METADATA_EXTENSION_URL]: record.immunization.metadata,
    }),
  };
};

const rabiesTitrationToObservation = (record: RabiesTitrationRecord): Observation => {
  const adequate = record.rabiesTitration.resultIuMl >= RABIES_TITRE_ADEQUATE_THRESHOLD;
  return {
    resourceType: 'Observation',
    id: record.artifact.id,
    status: toStatus(record.artifact.status),
    code: toCodeableConcept('RABIES_TITRATION', 'Rabies antibody titration'),
    subject: toReference(clinicalContextReference(record.artifact)),
    encounter: toReference(clinicalContextReference(record.artifact)),
    effectiveDateTime: toIso(record.rabiesTitration.sampleDate),
    valueQuantity: {
      value: record.rabiesTitration.resultIuMl,
      unit: 'IU/mL',
      system: 'http://unitsofmeasure.org',
      code: '[IU]/mL',
    },
    interpretation: [
      toCodeableConcept(
        adequate ? 'ADEQUATE' : 'INADEQUATE',
        adequate ? 'Adequate titre (>= 0.5 IU/mL)' : 'Inadequate titre (< 0.5 IU/mL)'
      ),
    ],
    performer: [{ display: record.rabiesTitration.approvedLab }],
    extension: buildKindExtensions(record.artifact, {
      [TITRATION_REPORT_EXTENSION_URL]: record.rabiesTitration.reportUrl ?? undefined,
      [TITRATION_METADATA_EXTENSION_URL]: record.rabiesTitration.metadata,
    }),
  };
};

const parasiteTreatmentToProcedure = (record: ParasiteTreatmentRecord): Procedure => ({
  resourceType: 'Procedure',
  id: record.artifact.id,
  status: toProcedureStatus(record.artifact.status),
  code: toCodeableConcept(
    record.parasiteTreatment.treatmentType,
    record.parasiteTreatment.productName
  ),
  subject: {
    reference: clinicalContextReference(record.artifact) ?? `Procedure/${record.artifact.id}`,
  },
  encounter: toReference(clinicalContextReference(record.artifact)),
  performedDateTime: toIso(record.parasiteTreatment.treatedAt),
  performer: record.artifact.authorId
    ? [{ actor: { reference: `Practitioner/${record.artifact.authorId}` } }]
    : undefined,
  note:
    typeof record.parasiteTreatment.notes === 'string'
      ? [{ text: record.parasiteTreatment.notes }]
      : undefined,
  extension: buildKindExtensions(record.artifact, {
    [PARASITE_MANUFACTURER_EXTENSION_URL]: record.parasiteTreatment.manufacturer ?? undefined,
    [PARASITE_METADATA_EXTENSION_URL]: record.parasiteTreatment.metadata,
  }),
});

const clinicalExamToComposition = (record: ClinicalExaminationRecord): Composition => ({
  resourceType: 'Composition',
  id: record.artifact.id,
  status: toStatus(record.artifact.status),
  type: toCodeableConcept('CLINICAL_EXAM', 'Pre-travel clinical examination'),
  title: record.artifact.summary ?? 'Clinical examination',
  date:
    toIso(record.clinicalExamination.examinedAt) ??
    toIso(record.artifact.updatedAt) ??
    new Date().toISOString(),
  author: [
    record.artifact.authorId
      ? { reference: `Practitioner/${record.artifact.authorId}` }
      : { display: 'System' },
  ],
  encounter: toReference(clinicalContextReference(record.artifact)),
  extension: buildKindExtensions(
    record.artifact,
    {
      [EXAM_FINDINGS_EXTENSION_URL]: record.clinicalExamination.findings ?? undefined,
      [EXAM_METADATA_EXTENSION_URL]: record.clinicalExamination.metadata,
    },
    [
      {
        url: EXAM_FIT_FOR_TRAVEL_EXTENSION_URL,
        valueBoolean: record.clinicalExamination.fitForTravel,
      },
      ...(record.clinicalExamination.weightKg === null
        ? []
        : [{ url: EXAM_WEIGHT_EXTENSION_URL, valueDecimal: record.clinicalExamination.weightKg }]),
      ...(record.clinicalExamination.temperatureC === null
        ? []
        : [
            {
              url: EXAM_TEMPERATURE_EXTENSION_URL,
              valueDecimal: record.clinicalExamination.temperatureC,
            },
          ]),
    ]
  ),
});

const bundles = {
  soapNotes: (records: SoapNoteRecord[]) => recordBundle(records, soapNoteToComposition),
  prescriptions: (records: PrescriptionRecord[]) =>
    recordBundle(records, prescriptionToMedicationRequest),
  dischargeSummaries: (records: DischargeSummaryRecord[]) =>
    recordBundle(records, dischargeSummaryToComposition),
  vitalRecords: (records: VitalRecordRecord[]) => recordBundle(records, vitalRecordToObservation),
  immunizations: (records: ImmunizationRecord[]) =>
    recordBundle(records, immunizationToImmunization),
  rabiesTitrations: (records: RabiesTitrationRecord[]) =>
    recordBundle(records, rabiesTitrationToObservation),
  parasiteTreatments: (records: ParasiteTreatmentRecord[]) =>
    recordBundle(records, parasiteTreatmentToProcedure),
  clinicalExaminations: (records: ClinicalExaminationRecord[]) =>
    recordBundle(records, clinicalExamToComposition),
};

export const clinicalArtifactFhirMapper = {
  soapNoteToComposition,
  compositionToSoapNoteInput,
  prescriptionToMedicationRequest,
  medicationRequestToPrescriptionInput,
  dischargeSummaryToComposition,
  compositionToDischargeSummaryInput,
  vitalRecordToObservation,
  observationToVitalRecordInput,
  immunizationToImmunization,
  rabiesTitrationToObservation,
  parasiteTreatmentToProcedure,
  clinicalExamToComposition,
  bundles,
};
