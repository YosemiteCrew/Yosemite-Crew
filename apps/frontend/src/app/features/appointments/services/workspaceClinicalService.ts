import type { Bundle, Composition, MedicationRequest, Observation } from '@yosemite-crew/fhir';
import { clinicalArtifactFhirMapper } from '@yosemite-crew/types';
import { postData, getData, patchData, deleteData } from '@/app/services/axios';
import type {
  AppointmentEncounter,
  ObservationRecord,
  PrescriptionItem,
  SoapNoteEntry,
  Vitals,
  WorkspaceDocument,
} from '@/app/features/appointments/types/workspace';

type ClinicalContext = {
  organisationId: string;
  appointmentId: string;
  encounterId?: string;
  authorId?: string;
  authorName?: string;
  templateId?: string;
  templateVersion?: number;
  templateVersionId?: string;
  dischargeSummaryId?: string;
};

type RenderedDocument = {
  id: string;
  kind: string;
  title: string;
  status: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  signedBy?: string | null;
  signedAt?: string | Date | null;
  pdfUrl?: string | null;
  signing?: { required?: boolean; status?: string | null } | null;
};

type WorkspaceClinicalHydrationFields =
  | 'soap'
  | 'vitals'
  | 'observations'
  | 'prescription'
  | 'dischargeSummary'
  | 'followUpAt'
  | 'dischargeSavedAt'
  | 'dischargeSavedByName'
  | 'dischargeSummaryId'
  | 'documents';

export type WorkspaceClinicalHydration = Partial<
  Pick<AppointmentEncounter, WorkspaceClinicalHydrationFields>
>;

type ObservationToolSubmission = {
  id?: string;
  _id?: string | { toString(): string };
  toolId?: string;
  toolName?: string;
  toolCategory?: string;
  answers?: Record<string, unknown>;
  score?: number | null;
  summary?: string | null;
  filledBy?: string;
  filledByName?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

type ObservationToolTaskPreview = {
  taskId: string;
  companionId?: string;
  status?: string;
  dueAt?: string | Date;
  toolId: string;
  toolName: string;
  toolCategory: string;
  submissionId?: string;
  submittedAt?: string | Date;
  score?: number;
  summary?: string;
  answersPreview?: Record<string, unknown>;
  evaluationAppointmentId?: string;
};

type ObservationSubmissionListFilters = {
  companionId?: string;
  toolId?: string;
  fromDate?: string | Date;
  toDate?: string | Date;
};

type ClinicalArtifactAction = '$finalize' | '$reopen' | '$amend';
type DischargeSummaryHydration = Pick<
  WorkspaceClinicalHydration,
  | 'dischargeSummary'
  | 'followUpAt'
  | 'dischargeSavedAt'
  | 'dischargeSavedByName'
  | 'dischargeSummaryId'
>;

const asIso = (value: unknown) => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
};

const isPersistedArtifactId = (value?: string) =>
  Boolean(value && !['draft', ''].includes(value) && !value.startsWith('local-'));

const bundleResources = <T>(bundle: Bundle | undefined, resourceType: string): T[] =>
  (bundle?.entry ?? []).flatMap((entry) => {
    const resource = entry.resource as ({ resourceType?: string } & T) | undefined;
    return resource?.resourceType === resourceType ? [resource] : [];
  });

const jsonExtension = (url: string, value: unknown) =>
  value === undefined
    ? undefined
    : {
        url,
        valueString: typeof value === 'string' ? value : JSON.stringify(value),
      };

const compactExtensions = (items: Array<{ url: string; valueString?: string } | undefined>) =>
  items.filter((item): item is { url: string; valueString?: string } => Boolean(item));

const getReferenceId = (reference?: string) => reference?.split('/').findLast(Boolean);

const displayFromReference = (
  reference: unknown,
  context: Pick<ClinicalContext, 'authorId' | 'authorName'>
) => {
  if (!reference || typeof reference !== 'object') return undefined;
  const ref = reference as { display?: unknown; reference?: unknown };
  if (typeof ref.display === 'string' && ref.display.trim()) return ref.display.trim();
  const authorReferenceId =
    typeof ref.reference === 'string' ? getReferenceId(ref.reference) : undefined;
  return authorReferenceId && authorReferenceId === context.authorId
    ? context.authorName
    : undefined;
};

const getClinicalAuthorName = (
  resource: Composition,
  context: Pick<ClinicalContext, 'authorId' | 'authorName'>
) => {
  const authorDisplay = (resource.author ?? [])
    .map((author) => displayFromReference(author, context))
    .find(Boolean);
  if (authorDisplay) return authorDisplay;

  const metadata = resource as { authorId?: unknown; signedBy?: unknown };
  const authorId = typeof metadata.authorId === 'string' ? metadata.authorId : undefined;
  if (authorId && authorId === context.authorId) return context.authorName;

  const signedBy = typeof metadata.signedBy === 'string' ? metadata.signedBy.trim() : '';
  return signedBy || undefined;
};

const stringifyObjectId = (value: ObservationToolSubmission['_id']) => {
  if (typeof value === 'string') return value;
  return value?.toString();
};

const answerPreviewToScores = (answers: Record<string, unknown> | undefined) =>
  Object.entries(answers ?? {}).reduce<Record<string, number | string>>((acc, [key, value]) => {
    if (typeof value === 'number' || typeof value === 'string') {
      acc[key] = value;
    } else if (typeof value === 'boolean') {
      acc[key] = value ? 'Yes' : 'No';
    }
    return acc;
  }, {});

const toIsoQueryValue = (value: string | Date | undefined) => {
  if (value instanceof Date) return value.toISOString();
  return value;
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const observationSubmissionQuery = (filters: ObservationSubmissionListFilters = {}) => ({
  patientId: filters.companionId,
  toolId: filters.toolId,
  fromDate: toIsoQueryValue(filters.fromDate),
  toDate: toIsoQueryValue(filters.toDate),
});

const SOAP_EXT = {
  subjective: 'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-subjective',
  objective: 'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-objective',
  assessment: 'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-assessment',
  plan: 'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-plan',
  // The shared clinical-artifact mapper round-trips this extension into the SoapNote.metadata
  // JSON column, so a custom-template structure override (schema + answers) persists and
  // rehydrates without any backend change.
  metadata: 'https://yosemitecrew.com/fhir/StructureDefinition/soap-note-metadata',
};

const DISCHARGE_EXT = {
  content: 'https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-content',
  followUp: 'https://yosemitecrew.com/fhir/StructureDefinition/discharge-summary-follow-up',
};

const VITALS_EXT = {
  vitals: 'https://yosemitecrew.com/fhir/StructureDefinition/vital-record-vitals',
  notes: 'https://yosemitecrew.com/fhir/StructureDefinition/vital-record-notes',
};

const PRESCRIPTION_EXT = {
  medications: 'https://yosemitecrew.com/fhir/StructureDefinition/prescription-medications',
  instructions: 'https://yosemitecrew.com/fhir/StructureDefinition/prescription-instructions',
};

const buildComposition = (
  context: ClinicalContext,
  kind: 'SOAP_NOTE' | 'DISCHARGE_SUMMARY',
  title: string,
  extensions: Composition['extension']
): Composition & Record<string, unknown> => {
  const encounter =
    context.encounterId === undefined
      ? undefined
      : { reference: `Encounter/${context.encounterId}` };
  return {
    resourceType: 'Composition',
    // Saving creates a draft record; only `$finalize` flips it to COMPLETED (see the
    // soapNoteFromComposition note below). Sending 'final' here would finalize the
    // artifact on every save.
    status: 'preliminary',
    title,
    type: { text: kind },
    date: new Date().toISOString(),
    author: context.authorId
      ? [{ reference: `Practitioner/${context.authorId}`, display: context.authorName }]
      : [{ display: 'System' }],
    encounter,
    extension: extensions,
    organisationId: context.organisationId,
    appointmentId: context.appointmentId,
    encounterId: context.encounterId,
    authorId: context.authorId,
    templateId: context.templateId,
    templateVersion: context.templateVersion,
    templateVersionId: context.templateVersionId,
  };
};

type SoapNoteCompositionContext = Pick<
  ClinicalContext,
  'organisationId' | 'appointmentId' | 'encounterId' | 'authorId' | 'authorName'
>;

const soapNoteFromComposition = (
  resource: Composition,
  context: SoapNoteCompositionContext
): SoapNoteEntry => {
  const input = clinicalArtifactFhirMapper.compositionToSoapNoteInput(resource, context);
  const signedByName = getClinicalAuthorName(resource, context);
  // Rehydrate a custom-template structure override from the metadata channel so a saved custom
  // SOAP note re-renders via FormRenderer (not the four native editors) after refresh.
  const metadata =
    input.metadata && typeof input.metadata === 'object'
      ? (input.metadata as Record<string, unknown>)
      : undefined;
  const customTemplate = metadata?.customTemplate as
    | { schema?: NonNullable<SoapNoteEntry['customSchema']>; answers?: Record<string, unknown> }
    | undefined;
  return {
    id: resource.id ?? `soap-${resource.date ?? Date.now()}`,
    chiefComplaint: '',
    subjective: toText(input.subjective),
    objective: toText(input.objective),
    assessment: toText(input.assessment),
    plan: toText(input.plan),
    templateId: input.templateId,
    templateVersionId: (input as { templateVersionId?: string }).templateVersionId,
    customSchema: customTemplate?.schema,
    customAnswers: customTemplate?.answers,
    // A SOAP note that came back from the backend is a saved record and belongs in the
    // "All SOAP notes" history, not the active draft. The backend stores saved notes as
    // `preliminary` (only `$finalize` flips it to `final`), so persisted id — not status —
    // is the signal that this is a past entry.
    status: resource.id ? 'COMPLETED' : 'IN_PROGRESS',
    signedByName,
    signedAt: resource.date,
    createdAt: resource.date ?? new Date().toISOString(),
  };
};

const vitalRecordFromObservation = (
  resource: Observation,
  index: number,
  context: Pick<ClinicalContext, 'organisationId' | 'appointmentId' | 'encounterId'>
): Vitals => {
  const input = clinicalArtifactFhirMapper.observationToVitalRecordInput(resource, context);
  const vitals =
    input.vitals && typeof input.vitals === 'object'
      ? (input.vitals as Record<string, unknown>)
      : {};
  // The recorder lives on the Observation's `performer` reference (the FHIR→input
  // mapper only echoes back the caller's default, so read the resource directly).
  // Prefer the reference `display` (a name); otherwise surface the practitioner id
  // so the consuming row can resolve it against the team roster.
  const performer = Array.isArray(resource.performer) ? resource.performer[0] : undefined;
  const performerDisplay =
    typeof performer?.display === 'string' && performer.display.trim()
      ? performer.display.trim()
      : undefined;
  const recordedById = getReferenceId(performer?.reference) ?? input.recordedBy ?? undefined;
  return {
    id: resource.id ?? `vital-${index + 1}`,
    code: `VT-${String(index + 1).padStart(3, '0')}`,
    weightLbs: typeof vitals.weightLbs === 'number' ? vitals.weightLbs : undefined,
    tempF: typeof vitals.tempF === 'number' ? vitals.tempF : undefined,
    heartRateBpm: typeof vitals.heartRateBpm === 'number' ? vitals.heartRateBpm : undefined,
    respRateBpm: typeof vitals.respRateBpm === 'number' ? vitals.respRateBpm : undefined,
    painScore: typeof vitals.painScore === 'number' ? vitals.painScore : undefined,
    notes: typeof input.notes === 'string' ? input.notes : undefined,
    recordedByName: performerDisplay ?? 'Clinician',
    recordedById: recordedById ?? undefined,
    recordedAt: asIso(input.measuredAt),
  };
};

const dischargeSummaryFromComposition = (
  resource: Composition,
  context: Pick<
    ClinicalContext,
    'organisationId' | 'appointmentId' | 'encounterId' | 'authorId' | 'authorName'
  >
): DischargeSummaryHydration => {
  const input = clinicalArtifactFhirMapper.compositionToDischargeSummaryInput(resource, context);
  return {
    dischargeSummary: toText(input.summaryContent),
    followUpAt: typeof input.followUp === 'string' ? input.followUp : undefined,
    dischargeSavedAt: asIso(resource.date),
    // Resolve to a human name (display, or the current author's name) — never
    // surface the raw author reference/id when no display is present.
    dischargeSavedByName: getClinicalAuthorName(resource, context),
    dischargeSummaryId: resource.id,
  };
};

export const listSoapNotesForAppointment = async (
  organisationId: string,
  appointmentId: string,
  context: Omit<ClinicalContext, 'organisationId' | 'appointmentId'>
) => {
  const res = await postData<Bundle>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/appointment/${appointmentId}/soap-notes`,
    {}
  );
  return bundleResources<Composition>(res.data, 'Composition').map((resource) =>
    soapNoteFromComposition(resource, {
      organisationId,
      appointmentId,
      ...context,
    })
  );
};

export const listSoapNotesForEncounter = async (
  organisationId: string,
  encounterId: string,
  context: Omit<ClinicalContext, 'organisationId' | 'encounterId'>
) => {
  const res = await postData<Bundle>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/encounter/${encounterId}/soap-notes`,
    {}
  );
  return bundleResources<Composition>(res.data, 'Composition').map((resource) =>
    soapNoteFromComposition(resource, {
      organisationId,
      encounterId,
      ...context,
    })
  );
};

export const getSoapNote = async (organisationId: string, soapNoteId: string) => {
  const res = await postData<Composition>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/soap-note/${soapNoteId}`,
    {}
  );
  return res.data;
};

const clinicalArtifactAction = async <T>(
  organisationId: string,
  artifactPath: 'soap-note' | 'prescription' | 'discharge-summary' | 'vital-record',
  artifactId: string,
  action: ClinicalArtifactAction,
  body: Record<string, unknown> = {}
) => {
  const res = await postData<T>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/${artifactPath}/${artifactId}/${action}`,
    body
  );
  return res.data;
};

export const finalizeSoapNote = (organisationId: string, soapNoteId: string) =>
  clinicalArtifactAction<Composition>(organisationId, 'soap-note', soapNoteId, '$finalize');

export const reopenSoapNote = (organisationId: string, soapNoteId: string) =>
  clinicalArtifactAction<Composition>(organisationId, 'soap-note', soapNoteId, '$reopen');

export const amendSoapNote = (
  organisationId: string,
  soapNoteId: string,
  body: Record<string, unknown> = {}
) => clinicalArtifactAction<Composition>(organisationId, 'soap-note', soapNoteId, '$amend', body);

export const saveSoapNote = async (context: ClinicalContext, note: SoapNoteEntry) => {
  // Custom-template override (structure swap): persist the schema + answers in the metadata
  // channel so the workspace re-renders the custom form after refresh.
  const customMetadata = note.customSchema?.length
    ? { customTemplate: { schema: note.customSchema, answers: note.customAnswers ?? {} } }
    : undefined;
  const body = buildComposition(
    context,
    'SOAP_NOTE',
    'SOAP note',
    compactExtensions([
      jsonExtension(SOAP_EXT.subjective, note.subjective),
      jsonExtension(SOAP_EXT.objective, note.objective),
      jsonExtension(SOAP_EXT.assessment, note.assessment),
      jsonExtension(SOAP_EXT.plan, note.plan),
      jsonExtension(SOAP_EXT.metadata, customMetadata),
    ])
  );
  const endpoint = `/fhir/v1/clinical-artifact/organisation/${context.organisationId}/soap-note`;
  // SOAP notes are a legal medical record: a signed (COMPLETED/final) note is immutable and is
  // never PATCHed — corrections go through a separate amendment ($amend). Only an unsigned draft
  // that was already persisted may be PATCHed; everything else creates a new finalized note.
  const canPatchDraft = isPersistedArtifactId(note.id) && note.status !== 'COMPLETED';
  const res = canPatchDraft
    ? await patchData<Composition>(`${endpoint}/${note.id}`, body)
    : await postData<Composition>(endpoint, body);
  return res.data;
};

export const listDischargeSummariesForAppointment = async (
  organisationId: string,
  appointmentId: string,
  context: Omit<ClinicalContext, 'organisationId' | 'appointmentId'>
) => {
  const res = await postData<Bundle>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/appointment/${appointmentId}/discharge-summaries`,
    {}
  );
  return bundleResources<Composition>(res.data, 'Composition').map((resource) =>
    dischargeSummaryFromComposition(resource, {
      organisationId,
      appointmentId,
      ...context,
    })
  );
};

export const listDischargeSummariesForEncounter = async (
  organisationId: string,
  encounterId: string,
  context: Omit<ClinicalContext, 'organisationId' | 'encounterId'>
) => {
  const res = await postData<Bundle>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/encounter/${encounterId}/discharge-summaries`,
    {}
  );
  return bundleResources<Composition>(res.data, 'Composition').map((resource) =>
    dischargeSummaryFromComposition(resource, {
      organisationId,
      encounterId,
      ...context,
    })
  );
};

export const getDischargeSummaryArtifact = async (
  organisationId: string,
  dischargeSummaryId: string
) => {
  const res = await postData<Composition>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/discharge-summary/${dischargeSummaryId}`,
    {}
  );
  return res.data;
};

export const finalizeDischargeSummary = (organisationId: string, dischargeSummaryId: string) =>
  clinicalArtifactAction<Composition>(
    organisationId,
    'discharge-summary',
    dischargeSummaryId,
    '$finalize'
  );

export const reopenDischargeSummary = (organisationId: string, dischargeSummaryId: string) =>
  clinicalArtifactAction<Composition>(
    organisationId,
    'discharge-summary',
    dischargeSummaryId,
    '$reopen'
  );

export const amendDischargeSummary = (
  organisationId: string,
  dischargeSummaryId: string,
  body: Record<string, unknown> = {}
) =>
  clinicalArtifactAction<Composition>(
    organisationId,
    'discharge-summary',
    dischargeSummaryId,
    '$amend',
    body
  );

export const saveDischargeSummaryArtifact = async (
  context: ClinicalContext,
  html: string,
  followUpAt?: string
) => {
  const body = buildComposition(
    context,
    'DISCHARGE_SUMMARY',
    'Discharge summary',
    compactExtensions([
      jsonExtension(DISCHARGE_EXT.content, html),
      jsonExtension(DISCHARGE_EXT.followUp, followUpAt),
    ])
  );
  const endpoint = `/fhir/v1/clinical-artifact/organisation/${context.organisationId}/discharge-summary`;
  // A persisted discharge summary is a saved clinical record; saving again creates a new one
  // (append-only) rather than PATCHing a record the backend treats as immutable. Only an
  // explicitly editable draft (not yet persisted) is created here.
  const res = await postData<Composition>(endpoint, body);
  return res.data;
};

export const listVitalRecordsForAppointment = async (
  organisationId: string,
  appointmentId: string,
  context: Omit<ClinicalContext, 'organisationId' | 'appointmentId'>
) => {
  const res = await postData<Bundle>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/appointment/${appointmentId}/vital-records`,
    {}
  );
  return bundleResources<Observation>(res.data, 'Observation').map((resource, index) =>
    vitalRecordFromObservation(resource, index, {
      organisationId,
      appointmentId,
      ...context,
    })
  );
};

export const listVitalRecordsForEncounter = async (
  organisationId: string,
  encounterId: string,
  context: Omit<ClinicalContext, 'organisationId' | 'encounterId'>
) => {
  const res = await postData<Bundle>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/encounter/${encounterId}/vital-records`,
    {}
  );
  return bundleResources<Observation>(res.data, 'Observation').map((resource, index) =>
    vitalRecordFromObservation(resource, index, {
      organisationId,
      encounterId,
      ...context,
    })
  );
};

export const getVitalRecord = async (organisationId: string, vitalRecordId: string) => {
  const res = await postData<Observation>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/vital-record/${vitalRecordId}`,
    {}
  );
  return res.data;
};

export const finalizeVitalRecord = (organisationId: string, vitalRecordId: string) =>
  clinicalArtifactAction<Observation>(organisationId, 'vital-record', vitalRecordId, '$finalize');

export const reopenVitalRecord = (organisationId: string, vitalRecordId: string) =>
  clinicalArtifactAction<Observation>(organisationId, 'vital-record', vitalRecordId, '$reopen');

export const amendVitalRecord = (
  organisationId: string,
  vitalRecordId: string,
  body: Record<string, unknown> = {}
) =>
  clinicalArtifactAction<Observation>(
    organisationId,
    'vital-record',
    vitalRecordId,
    '$amend',
    body
  );

export const saveVitalRecord = async (
  context: ClinicalContext,
  vital: Vitals | Omit<Vitals, 'id' | 'code'>
) => {
  const body: Observation & Record<string, unknown> = {
    resourceType: 'Observation',
    // Saving creates a draft vital record; $finalize completes it. 'final' would
    // finalize on every save.
    status: 'preliminary',
    code: { text: 'VITAL_RECORD' },
    effectiveDateTime: vital.recordedAt,
    extension: compactExtensions([
      jsonExtension(VITALS_EXT.vitals, vital),
      jsonExtension(VITALS_EXT.notes, vital.notes),
    ]),
    organisationId: context.organisationId,
    appointmentId: context.appointmentId,
    encounterId: context.encounterId,
    authorId: context.authorId,
    recordedBy: context.authorId,
    templateId: context.templateId,
    templateVersion: context.templateVersion,
    templateVersionId: context.templateVersionId,
  };
  const vitalId = 'id' in vital ? vital.id : undefined;
  const endpoint = `/fhir/v1/clinical-artifact/organisation/${context.organisationId}/vital-record`;
  const res = isPersistedArtifactId(vitalId)
    ? await patchData<Observation>(`${endpoint}/${vitalId}`, body)
    : await postData<Observation>(endpoint, body);
  return res.data;
};

/** Map a backend observation-tool submission to the workspace ObservationRecord. */
const submissionToObservationRecord = (
  submission: ObservationToolSubmission,
  index: number
): ObservationRecord => ({
  id: submission.id ?? stringifyObjectId(submission._id) ?? `ot-${index + 1}`,
  code: `OT-${String(index + 1).padStart(3, '0')}`,
  toolKey: submission.toolId ?? submission.toolCategory ?? 'OBSERVATION_TOOL',
  toolName: submission.toolName ?? submission.toolCategory ?? 'Observation tool',
  scores: answerPreviewToScores(submission.answers),
  total: typeof submission.score === 'number' ? submission.score : undefined,
  recordedByName: submission.filledByName ?? submission.filledBy ?? 'Parent',
  recordedAt: asIso(submission.createdAt ?? submission.updatedAt),
});

export const listObservationSubmissionsForAppointment = async (
  appointmentId: string
): Promise<ObservationRecord[]> => {
  const res = await postData<ObservationToolSubmission[]>(
    `/v1/observation-tools/pms/appointments/${appointmentId}/submissions`,
    {}
  );
  return res.data.map((submission, index) => submissionToObservationRecord(submission, index));
};

export type PmsObservationSubmissionInput = {
  organisationId: string;
  appointmentId: string;
  encounterId?: string;
  companionId: string;
  toolId: string;
  taskId?: string;
  filledBy: string;
  answers: Record<string, unknown>;
  summary?: string;
};

/**
 * Create a clinician-recorded observation-tool submission via the existing PMS
 * route. The BACKEND computes the score from the tool definition — the returned
 * submission's `score` is authoritative (we never derive clinical math here).
 * Returns the mapped ObservationRecord so the workspace can show the real result.
 */
export const createPmsObservationSubmission = async (
  input: PmsObservationSubmissionInput
): Promise<ObservationRecord> => {
  const res = await postData<ObservationToolSubmission>(
    `/v1/observation-tools/pms/appointments/${input.appointmentId}/submissions/create`,
    {
      organisationId: input.organisationId,
      appointmentId: input.appointmentId,
      encounterId: input.encounterId,
      companionId: input.companionId,
      toolId: input.toolId,
      taskId: input.taskId,
      filledBy: input.filledBy,
      answers: input.answers,
      summary: input.summary,
    }
  );
  return submissionToObservationRecord(res.data, 0);
};

export const listPmsObservationSubmissions = async (
  filters: ObservationSubmissionListFilters = {}
) => {
  const res = await getData<ObservationToolSubmission[]>(
    '/v1/observation-tools/pms/submissions',
    observationSubmissionQuery(filters)
  );
  return res.data ?? [];
};

export const getPmsObservationSubmission = async (submissionId: string) => {
  const res = await getData<ObservationToolSubmission>(
    `/v1/observation-tools/pms/submissions/${submissionId}`
  );
  return res.data;
};

export const linkPmsObservationSubmissionToAppointment = async (
  submissionId: string,
  appointmentId: string,
  enforceSingle = false
) => {
  const res = await postData<ObservationToolSubmission>(
    `/v1/observation-tools/pms/submissions/${submissionId}/link-appointment`,
    { appointmentId, enforceSingle }
  );
  return res.data;
};

export const getPmsObservationSubmissionByTask = async (taskId: string) => {
  const res = await getData<ObservationToolSubmission>(
    `/v1/observation-tools/pms/tasks/${taskId}/submission`
  );
  return res.data;
};

export const getPmsObservationTaskPreview = async (taskId: string) => {
  const res = await getData<ObservationToolTaskPreview>(
    `/v1/observation-tools/pms/tasks/${taskId}/preview`
  );
  return res.data;
};

export const listPmsObservationTaskPreviewsForAppointment = async (appointmentId: string) => {
  const res = await getData<ObservationToolTaskPreview[]>(
    `/v1/observation-tools/pms/appointments/${appointmentId}/task-previews`
  );
  return res.data ?? [];
};

export const savePrescriptionArtifact = async (
  context: ClinicalContext,
  prescription: PrescriptionItem | Omit<PrescriptionItem, 'id'>
) => {
  // The backend persists prescription lines into TYPED columns (medication, strength, dosage,
  // route, frequency, duration, quantity, refill, instructions, inventoryItemId/Sku, batch…) and
  // stashes anything else in a per-item `metadata` JSON column. So the flat fields below survive as
  // columns, and the display-only / unit fields that have no column are nested under `metadata`
  // so they round-trip. `dose` is sent both flat (BE maps it to the `dosage` column) and kept in
  // metadata for an exact rehydrate.
  const { id: _id, ...lineFields } = prescription as PrescriptionItem;
  const medicationLine = {
    ...lineFields,
    // BE reads `dosage` from ["dosage","dose"]; send the per-administration amount there.
    dosage: prescription.dose ?? prescription.dosage,
    metadata: {
      brand: prescription.brand,
      genericName: prescription.genericName,
      sku: prescription.sku,
      strengthUnit: prescription.strengthUnit,
      dose: prescription.dose,
      doseUnit: prescription.doseUnit,
      durationUnit: prescription.durationUnit,
      dosageForm: prescription.dosageForm,
      fulfillment: prescription.fulfillment,
      priceCents: prescription.priceCents,
      stockQty: prescription.stockQty,
      lowStock: prescription.lowStock,
      controlledSubstance: prescription.controlledSubstance,
      drugSchedule: prescription.drugSchedule,
      prescriptionRequired: prescription.prescriptionRequired,
    },
  };
  const body: MedicationRequest & Record<string, unknown> = {
    resourceType: 'MedicationRequest',
    // Saving creates a draft prescription; only $finalize completes it (and triggers
    // the inventory dispense). 'active' here would dispense on every plain save.
    status: 'draft',
    intent: 'order',
    medicationCodeableConcept: { text: prescription.medicineName },
    medicationReference: { display: prescription.medicineName },
    subject: { display: 'Patient' },
    encounter:
      context.encounterId === undefined
        ? undefined
        : { reference: `Encounter/${context.encounterId}` },
    extension: compactExtensions([
      jsonExtension(PRESCRIPTION_EXT.medications, [medicationLine]),
      jsonExtension(PRESCRIPTION_EXT.instructions, prescription.instructions),
    ]),
    organisationId: context.organisationId,
    appointmentId: context.appointmentId,
    encounterId: context.encounterId,
    authorId: context.authorId,
    templateId: context.templateId,
    templateVersion: context.templateVersion,
    templateVersionId: context.templateVersionId,
  };
  const prescriptionId = 'id' in prescription ? prescription.id : undefined;
  const endpoint = `/fhir/v1/clinical-artifact/organisation/${context.organisationId}/prescription`;
  const res = isPersistedArtifactId(prescriptionId)
    ? await patchData<MedicationRequest>(`${endpoint}/${prescriptionId}`, body)
    : await postData<MedicationRequest>(endpoint, body);
  return res.data;
};

const prescriptionFromMedicationRequest = (
  resource: MedicationRequest,
  index: number,
  context: Omit<ClinicalContext, 'organisationId' | 'appointmentId'> &
    Pick<ClinicalContext, 'organisationId' | 'appointmentId'>
): PrescriptionItem => {
  const input = clinicalArtifactFhirMapper.medicationRequestToPrescriptionInput(resource, context);
  const medications = Array.isArray(input.medications) ? input.medications : [];
  // The backend persists the line into TYPED columns (medication/dosage/route/frequency/duration/
  // quantity/refill/inventoryItemId/inventoryItemSku) and keeps display/unit extras in a nested
  // `metadata` object. Coalesce both shapes (BE column name ?? our field name ?? metadata) so a
  // round-tripped prescription rehydrates fully.
  const raw = (medications[0] ?? {}) as Record<string, unknown>;
  const meta =
    raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};
  const str = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = raw[key] ?? meta[key];
      if (typeof value === 'string' && value.trim()) return value;
      if (typeof value === 'number') return String(value);
    }
    return undefined;
  };
  const bool = (...keys: string[]): boolean | undefined => {
    for (const key of keys) {
      const value = raw[key] ?? meta[key];
      if (typeof value === 'boolean') return value;
    }
    return undefined;
  };
  const num = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const value = raw[key] ?? meta[key];
      if (typeof value === 'number') return value;
    }
    return undefined;
  };
  const fulfillmentValue = str('fulfillment');
  return {
    id: resource.id ?? `rx-${index + 1}`,
    medicineName:
      str('medication', 'medicineName', 'name') ??
      resource.medicationCodeableConcept?.text ??
      resource.medicationReference?.display ??
      'Medication',
    brand: str('brand'),
    genericName: str('genericName'),
    sku: str('sku', 'inventoryItemSku'),
    strength: str('strength'),
    strengthUnit: str('strengthUnit'),
    dosageForm: str('dosageForm'),
    dosage: str('dosage'),
    dose: str('dose', 'dosage'),
    doseUnit: str('doseUnit'),
    route: str('route', 'routeOfAdministration'),
    frequency: str('frequency'),
    durationDays: str('duration', 'durationDays'),
    durationUnit: str('durationUnit'),
    qty: str('quantity', 'qty'),
    refill: str('refill'),
    drugSchedule: str('drugSchedule'),
    prescriptionRequired: bool('prescriptionRequired'),
    instructions:
      str('instructions') ??
      (typeof input.instructions === 'string' ? input.instructions : undefined),
    fulfillment: fulfillmentValue === 'IN_HOUSE' ? 'IN_HOUSE' : 'PRESCRIPTION_ONLY',
    priceCents: num('priceCents'),
    stockQty: num('stockQty'),
    lowStock: bool('lowStock'),
    controlledSubstance: bool('controlledSubstance', 'controlledItem'),
    inventoryItemId: str('inventoryItemId'),
    inventoryBatchId: str('inventoryBatchId', 'batchId'),
  };
};

export const listPrescriptionsForAppointment = async (
  organisationId: string,
  appointmentId: string,
  context: Omit<ClinicalContext, 'organisationId' | 'appointmentId'>
) => {
  const res = await postData<Bundle>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/appointment/${appointmentId}/prescriptions`,
    {}
  );
  return bundleResources<MedicationRequest>(res.data, 'MedicationRequest').map((resource, index) =>
    prescriptionFromMedicationRequest(resource, index, {
      organisationId,
      appointmentId,
      ...context,
    })
  );
};

/**
 * Delete (void) an unbilled DRAFT prescription artifact via the clinical-artifact REST DELETE
 * (`DELETE …/prescription/:prescriptionId`). The backend soft-deletes (marks VOID), cascades the
 * linked workspace treatment-item row, and excludes voided prescriptions from list/bootstrap reads.
 * Contract: `204 No Content` on success; `409 Conflict` when finalized/billed (re-thrown for the
 * caller to surface). Returns true on success, or false only if the route is unavailable
 * (404/405/501) so the caller can fall back to the legacy treatment-item delete.
 */
export const deletePrescriptionArtifact = async (
  organisationId: string,
  prescriptionId: string
): Promise<boolean> => {
  try {
    await deleteData(
      `/fhir/v1/clinical-artifact/organisation/${organisationId}/prescription/${prescriptionId}`
    );
    return true;
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    // Route not implemented yet → let the caller fall back. Re-throw real failures.
    if (status === 404 || status === 405 || status === 501) return false;
    throw error;
  }
};

export const listPrescriptionsForEncounter = async (
  organisationId: string,
  encounterId: string,
  context: Omit<ClinicalContext, 'organisationId' | 'encounterId'>
) => {
  const res = await postData<Bundle>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/encounter/${encounterId}/prescriptions`,
    {}
  );
  return bundleResources<MedicationRequest>(res.data, 'MedicationRequest').map((resource, index) =>
    prescriptionFromMedicationRequest(resource, index, {
      organisationId,
      encounterId,
      ...context,
    })
  );
};

export const getPrescriptionArtifact = async (organisationId: string, prescriptionId: string) => {
  const res = await postData<MedicationRequest>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/prescription/${prescriptionId}`,
    {}
  );
  return res.data;
};

/**
 * Generate a label-format PDF for a prescription (pharmacy dispensing labels: medication, strength,
 * dosage, frequency, route, instructions, patient/owner, clinic, date). Returns the rendered PDF
 * URL. Backed by the new backend label endpoint (handoff §3); until that ships this resolves the
 * URL from the standard rendered-document response shape.
 */
export const generatePrescriptionLabels = async (
  organisationId: string,
  prescriptionId: string
): Promise<string | undefined> => {
  const res = await postData<{ url?: string; pdfUrl?: string; renderedDocumentId?: string }>(
    `/fhir/v1/clinical-artifact/organisation/${organisationId}/prescription/${prescriptionId}/labels`,
    {}
  );
  return res.data?.url ?? res.data?.pdfUrl;
};

export const finalizePrescriptionArtifact = (organisationId: string, prescriptionId: string) =>
  clinicalArtifactAction<MedicationRequest>(
    organisationId,
    'prescription',
    prescriptionId,
    '$finalize'
  );

export const reopenPrescriptionArtifact = (organisationId: string, prescriptionId: string) =>
  clinicalArtifactAction<MedicationRequest>(
    organisationId,
    'prescription',
    prescriptionId,
    '$reopen'
  );

export const amendPrescriptionArtifact = (
  organisationId: string,
  prescriptionId: string,
  body: Record<string, unknown> = {}
) =>
  clinicalArtifactAction<MedicationRequest>(
    organisationId,
    'prescription',
    prescriptionId,
    '$amend',
    body
  );

export const loadWorkspaceClinicalArtifacts = async (
  context: Pick<
    ClinicalContext,
    'organisationId' | 'appointmentId' | 'encounterId' | 'authorId' | 'authorName'
  >
): Promise<WorkspaceClinicalHydration> => {
  const [soapResult, vitalsResult, observationResult, prescriptionsResult, dischargeResult] =
    await Promise.allSettled([
      listSoapNotesForAppointment(context.organisationId, context.appointmentId, context),
      listVitalRecordsForAppointment(context.organisationId, context.appointmentId, context),
      listObservationSubmissionsForAppointment(context.appointmentId),
      listPrescriptionsForAppointment(context.organisationId, context.appointmentId, context),
      listDischargeSummariesForAppointment(context.organisationId, context.appointmentId, context),
    ]);

  const patch: WorkspaceClinicalHydration = {};

  if (soapResult.status === 'fulfilled' && soapResult.value.length > 0) {
    patch.soap = soapResult.value;
  }
  if (vitalsResult.status === 'fulfilled' && vitalsResult.value.length > 0) {
    patch.vitals = vitalsResult.value;
  }
  if (observationResult.status === 'fulfilled' && observationResult.value.length > 0) {
    patch.observations = observationResult.value;
  }
  if (prescriptionsResult.status === 'fulfilled' && prescriptionsResult.value.length > 0) {
    patch.prescription = prescriptionsResult.value;
  }
  if (dischargeResult.status === 'fulfilled' && dischargeResult.value.length > 0) {
    const summary = dischargeResult.value.at(0);
    patch.dischargeSummary = summary?.dischargeSummary;
    patch.followUpAt = summary?.followUpAt;
    patch.dischargeSavedAt = summary?.dischargeSavedAt;
    patch.dischargeSavedByName = summary?.dischargeSavedByName;
    patch.dischargeSummaryId = summary?.dischargeSummaryId;
  }

  return patch;
};

export const getRenderedDocument = async (organisationId: string, renderedDocumentId: string) => {
  const res = await getData<RenderedDocument>(
    `/fhir/v1/rendered-document/organisation/${organisationId}/${renderedDocumentId}`
  );
  return res.data;
};

export const signRenderedDocument = async (
  organisationId: string,
  renderedDocumentId: string,
  signatureText?: string
) => {
  const res = await postData<{ documentId: string; signingUrl?: string }>(
    `/fhir/v1/rendered-document/organisation/${organisationId}/${renderedDocumentId}/sign`,
    { signatureText }
  );
  return res.data;
};

export const renderedDocumentToWorkspaceDocument = (
  document: RenderedDocument
): WorkspaceDocument => ({
  id: document.id,
  createdAt: asIso(document.createdAt),
  category: document.kind === 'DISCHARGE_SUMMARY' ? 'Discharge' : 'SOAP',
  description: document.title,
  signedByName: document.signedBy ?? undefined,
  lastModifiedAt: asIso(document.updatedAt),
  signatureRequired: document.signing?.required ?? document.status !== 'SIGNED',
  status: document.status,
  signingStatus: document.signing?.status ?? undefined,
  pdfUrl: document.pdfUrl ?? null,
});
