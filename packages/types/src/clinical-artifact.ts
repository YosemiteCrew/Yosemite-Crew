import type {
  Bundle,
  CodeableConcept,
  Composition,
  CompositionAttester,
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

/**
 * Structured coded terms attached to a SOAP note, keyed by section. This is the
 * shape the PIMS workspace writes into the SoapNote `diagnoses` JSON channel
 * (round-tripped through the `soap-note-diagnoses` composition extension), so a
 * free-text note also carries exact vocabulary references. Kept alongside
 * SoapNoteInput because both ends of the wire must agree on it.
 */
export const SOAP_CODED_SECTIONS = ['subjective', 'objective', 'assessment', 'plan'] as const;

export type SoapCodedSection = (typeof SOAP_CODED_SECTIONS)[number];

/**
 * A crosswalk recorded alongside a pick. Stored so the note shows the same
 * codes the clinician saw when choosing, even if the mapping table later
 * changes; the FHIR export still projects live from CodeMapping.
 */
export type SoapCodedTermCoding = {
  system: string;
  code: string;
  equivalence?: string;
};

export type SoapCodedTerm = {
  /** Yosemite vocabulary code, e.g. YC-005416. */
  ycCode: string;
  /** Display label the clinician picked (the concept's display at pick time). */
  label: string;
  /** VeNom-style domain the term belongs to, when known (e.g. Diagnosis). */
  domain?: string;
  /** Cross-vocabulary codes shown at pick time (VeNom/SNOMED). */
  codings?: SoapCodedTermCoding[];
};

export type SoapCodedProblems = Partial<Record<SoapCodedSection, SoapCodedTerm[]>>;

/** Bound per section so a malformed or hostile payload cannot balloon the JSON column. */
const MAX_CODED_TERMS_PER_SECTION = 50;

/** Bounded like the section cap: a term has one crosswalk per system, not a list. */
const MAX_CODINGS_PER_TERM = 8;

const parseSoapCodedTerm = (value: unknown): SoapCodedTerm | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  const ycCode = typeof entry.ycCode === 'string' ? entry.ycCode.trim() : '';
  const label = typeof entry.label === 'string' ? entry.label.trim() : '';
  if (!ycCode || !label) return null;
  const domain =
    typeof entry.domain === 'string' && entry.domain.trim() ? entry.domain.trim() : undefined;
  const codings = Array.isArray(entry.codings)
    ? entry.codings
        .map((value) => {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
          const coding = value as Record<string, unknown>;
          const system = typeof coding.system === 'string' ? coding.system.trim() : '';
          const code = typeof coding.code === 'string' ? coding.code.trim() : '';
          if (!system || !code) return null;
          const equivalence =
            typeof coding.equivalence === 'string' && coding.equivalence.trim()
              ? coding.equivalence.trim()
              : undefined;
          return equivalence === undefined ? { system, code } : { system, code, equivalence };
        })
        .filter((coding): coding is SoapCodedTermCoding => coding !== null)
        .slice(0, MAX_CODINGS_PER_TERM)
    : [];
  return {
    ycCode,
    label,
    ...(domain === undefined ? {} : { domain }),
    ...(codings.length > 0 ? { codings } : {}),
  };
};

/** One section's raw payload → valid terms: drops malformed entries, dedups by code, caps the count. */
const parseSectionTerms = (raw: unknown): SoapCodedTerm[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const terms: SoapCodedTerm[] = [];
  for (const item of raw) {
    if (terms.length >= MAX_CODED_TERMS_PER_SECTION) break;
    const term = parseSoapCodedTerm(item);
    if (!term || seen.has(term.ycCode)) continue;
    seen.add(term.ycCode);
    terms.push(term);
  }
  return terms;
};

/**
 * Validate an untyped `diagnoses` payload into SoapCodedProblems. Only the four
 * known section keys are read (never arbitrary keys, so `__proto__`/`constructor`
 * payloads are ignored by construction), entries missing a code or label are
 * dropped, and duplicates within a section collapse onto the first occurrence.
 * Returns undefined when nothing valid remains, so an absent/legacy payload and
 * an empty one look the same to callers.
 */
export const parseSoapCodedProblems = (value: unknown): SoapCodedProblems | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const result: SoapCodedProblems = {};
  let total = 0;
  for (const section of SOAP_CODED_SECTIONS) {
    if (!Object.prototype.hasOwnProperty.call(source, section)) continue;
    const terms = parseSectionTerms(source[section]);
    if (terms.length > 0) {
      result[section] = terms;
      total += terms.length;
    }
  }
  return total > 0 ? result : undefined;
};

export type SoapNoteRecord = {
  artifact: {
    id: string;
    organisationId: string;
    appointmentId: string | null;
    caseId: string | null;
    encounterId: string | null;
    // Patient (companion) the artifact is about. FHIR subject/patient elements must
    // reference the Patient, so projections carry it alongside the clinical context.
    patientId?: string | null;
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
    items?: unknown;
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
export const SOAP_DIAGNOSES_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-diagnoses';
/**
 * Typed FHIR surface for picked coded terms: one complex extension per term,
 * carrying a `section` discriminator and a `concept` valueCodeableConcept whose
 * codings hold the Yosemite code plus any usable VeNom/SNOMED translations.
 * Derived at read time from the raw `soap-note-diagnoses` channel - never stored,
 * so a signed note's record is immutable while projections stay current.
 */
export const SOAP_CODED_TERM_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-coded-term';
/**
 * Per-coding ConceptMap equivalence (FHIR ConceptMapEquivalence code, lowercase),
 * so a NARROWER or INEXACT crosswalk is never passed off as an exact translation.
 */
export const CONCEPT_MAP_EQUIVALENCE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/concept-map-equivalence';
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

// The clinician who attests a signed artifact is often not the person who captured it
// (a nurse records the exam, a veterinarian signs it off). FHIR keeps the capture author
// in `author` and the signatory in `attester`, so both identities survive an export.
const compositionAttester = (artifact: {
  signedBy: string | null;
  signedAt: Date | null;
}): CompositionAttester[] | undefined =>
  artifact.signedBy
    ? [
        {
          mode: 'legal',
          time: toIso(artifact.signedAt),
          party: { reference: `Practitioner/${artifact.signedBy}` },
        },
      ]
    : undefined;

const clinicalContextReference = (artifact: {
  encounterId: string | null;
  appointmentId: string | null;
}) => {
  if (artifact.encounterId) return `Encounter/${artifact.encounterId}`;
  if (artifact.appointmentId) return `Appointment/${artifact.appointmentId}`;
  return undefined;
};

const UNKNOWN_PATIENT_DISPLAY = 'Unknown patient';

const patientReference = (artifact: { patientId?: string | null }): Reference | undefined =>
  artifact.patientId ? { reference: `Patient/${artifact.patientId}` } : undefined;

// subject/patient are 1..1 on MedicationRequest, Immunization and Procedure: when the
// patient is unknown emit a display-only Reference rather than the clinical context.
const requiredPatientReference = (artifact: { patientId?: string | null }): Reference =>
  patientReference(artifact) ?? { display: UNKNOWN_PATIENT_DISPLAY };

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

// Immunization.status is bound to a required value set (completed | entered-in-error |
// not-done), so unfinished artifacts map to 'not-done' rather than claiming administration.
const toImmunizationStatus = (status: string): string => {
  switch (status) {
    case 'SIGNED':
    case 'COMPLETED':
      return 'completed';
    case 'VOID':
      return 'entered-in-error';
    default:
      return 'not-done';
  }
};

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
  attester: compositionAttester(record.artifact),
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
  subject: requiredPatientReference(record.artifact),
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
  attester: compositionAttester(record.artifact),
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

/**
 * The unit of a vital is currently encoded in its key name - tempF, weightLbs - which
 * means a FHIR Observation carrying a bare number is not interpretable: 212 could be
 * degrees Fahrenheit or Celsius, and a weight of 12 could be pounds or kilograms. That is
 * not hypothetical here, since vitals record weightLbs while the passport and body
 * condition surfaces record weightKg.
 *
 * UCUM is what FHIR expects for exactly this. A measured vital becomes a valueQuantity
 * carrying its unit as a code, so a receiving system can convert rather than guess.
 */
const UCUM_SYSTEM = 'http://unitsofmeasure.org';

/**
 * Vitals whose storage key determines their unit beyond doubt.
 *
 * tempF and weightLbs are deliberately absent. VitalsForm's resolveDraftKey routes any
 * template field whose label contains "temp" into tempF and any "weight" into weightLbs,
 * whatever unit that template declares - there is a test covering a field declared in
 * Celsius. Stamping [degF] on a Celsius reading would export 38.5 as severe hypothermia
 * rather than a normal canine temperature: a confident, wrong clinical claim, which is
 * worse than the unqualified number it replaced. They stay unqualified until the stored
 * vital carries the unit it was entered in.
 */
const VITAL_UNITS: Record<string, { unit: string; code: string }> = {
  tempC: { unit: '°C', code: 'Cel' },
  weightKg: { unit: 'kg', code: 'kg' },
  heartRateBpm: { unit: 'beats/min', code: '/min' },
  respRateBpm: { unit: 'breaths/min', code: '/min' },
  crtSec: { unit: 's', code: 's' },
  // Dimensionless scales. UCUM annotates these rather than leaving them bare, which
  // distinguishes "a score of 5" from "5 of something unstated".
  bcs: { unit: 'score', code: '{score}' },
  painScore: { unit: 'score', code: '{score}' },
};

/**
 * Own properties only. A vital named "constructor" or "toString" - reachable through the
 * passthrough Observation endpoint - would otherwise find an inherited function on the
 * prototype, which is truthy, and emit a valueQuantity carrying the UCUM system with no
 * unit or code at all.
 */
const unitsFor = (key: string) =>
  Object.prototype.hasOwnProperty.call(VITAL_UNITS, key) ? VITAL_UNITS[key] : undefined;

/** Longest first, so "<=" is not read as "<" followed by an unparseable "=2". */
const QUANTITY_COMPARATORS = ['<=', '>=', '<', '>'] as const;

type QuantityComparator = (typeof QUANTITY_COMPARATORS)[number];

type MeasuredValue = { value: number; comparator?: QuantityComparator };

/**
 * CRT is free text in VitalsForm - the field is inputMode 'text' with no bounds - so it
 * arrives as a string, and a numeric-only branch would skip a known clinical vital.
 *
 * It also arrives as comparator notation: "<2" is what this repo's own VitalsForm and
 * QuickActionsModal stories store, because "capillary refill under two seconds" is how
 * the reading is taken. Parsing only the bare digits would drop those to a unitless
 * valueString, losing the seconds unit and the bound with it. FHIR carries exactly this
 * in Quantity.comparator, so "<2" exports as two seconds bounded above.
 *
 * Anything that is not a comparator followed by a number stays prose for the caller to
 * read, rather than being coerced into a number it never claimed to be.
 */
const asMeasuredValue = (value: unknown): MeasuredValue | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? { value } : null;
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (text === '') return null;

  const comparator = QUANTITY_COMPARATORS.find((candidate) => text.startsWith(candidate));
  const magnitude = comparator ? text.slice(comparator.length).trim() : text;
  if (magnitude === '') return null;

  const parsed = Number(magnitude);
  if (!Number.isFinite(parsed)) return null;

  return comparator ? { value: parsed, comparator } : { value: parsed };
};

const vitalComponentValue = (key: string, value: unknown) => {
  const units = unitsFor(key);
  const measured = units ? asMeasuredValue(value) : null;
  if (units && measured) {
    return {
      valueQuantity: {
        value: measured.value,
        ...(measured.comparator ? { comparator: measured.comparator } : {}),
        unit: units.unit,
        system: UCUM_SYSTEM,
        code: units.code,
      },
    };
  }
  if (typeof value === 'number') return { valueDecimal: value };
  if (typeof value === 'boolean') return { valueBoolean: value };
  if (typeof value === 'string') return { valueString: value };
  return { valueString: stringifyMaybe(value) ?? '' };
};

const vitalRecordToObservation = (record: VitalRecordRecord): Observation => {
  const vitalsValue = record.vitalRecord.vitals;
  const component =
    vitalsValue && typeof vitalsValue === 'object' && !Array.isArray(vitalsValue)
      ? Object.entries(vitalsValue as Record<string, unknown>).map(([key, value]) => ({
          code: toCodeableConcept(key, key),
          ...vitalComponentValue(key, value),
        }))
      : undefined;

  return {
    resourceType: 'Observation',
    id: record.artifact.id,
    status: toStatus(record.artifact.status),
    code: toCodeableConcept('VITAL_RECORD', 'Vital record'),
    subject: patientReference(record.artifact),
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

// occurrence[x] is a FHIR choice element, but the generated type marks both variants
// required, so the emitted resource keeps occurrenceDateTime only.
type ImmunizationResource = Omit<Immunization, 'occurrenceString'>;

const immunizationToImmunization = (record: ImmunizationRecord): ImmunizationResource => {
  const occurrence = toIso(record.immunization.dateAdministered) ?? new Date().toISOString();
  return {
    resourceType: 'Immunization',
    id: record.artifact.id,
    status: toImmunizationStatus(record.artifact.status),
    vaccineCode: toCodeableConcept(
      record.immunization.vaccineType,
      record.immunization.vaccineName
    ),
    patient: requiredPatientReference(record.artifact),
    occurrenceDateTime: occurrence,
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
    subject: patientReference(record.artifact),
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
  subject: requiredPatientReference(record.artifact),
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
  attester: compositionAttester(record.artifact),
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
