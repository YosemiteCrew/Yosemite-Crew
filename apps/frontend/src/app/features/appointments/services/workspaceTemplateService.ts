import {
  CANONICAL_SOAP_FIELD_KEYS,
  templateSchemaToFormFields,
  type TemplateInstanceLike,
  type TemplateInstanceUpsertInput,
  type TemplateKind,
  type TemplateLike,
  type TemplateResolveResponse,
  type TemplateSchemaSnapshot,
} from '@yosemite-crew/types';
import type { Task as FhirTask } from '@yosemite-crew/fhir';
import { getData, patchData, postData } from '@/app/services/axios';
import type { FormField } from '@/app/features/forms/types/forms';
import type { SoapTemplate } from '@/app/features/appointments/types/workspace';

type TemplateListParams = {
  kind?: TemplateKind;
  status?: string;
  scope?: string;
};

const listTemplates = async (url: string, params: TemplateListParams = {}) => {
  const res = await getData<TemplateLike[]>(url, params);
  return Array.isArray(res.data) ? res.data : [];
};

const dedupeTemplates = (templates: TemplateLike[]) => {
  const byId = new Map<string, TemplateLike>();
  for (const template of templates) {
    if (!template?.id) continue;
    byId.set(template.id, template);
  }
  return [...byId.values()];
};

export const listWorkspaceTemplates = async (
  organisationId: string,
  params: TemplateListParams = {}
) => {
  const [libraryResult, organisationResult, userResult] = await Promise.allSettled([
    listTemplates('/v1/templates/pms/templates/library', params),
    listTemplates(`/v1/templates/pms/templates/organisation/${organisationId}`, params),
    listTemplates(`/v1/templates/pms/templates/organisation/${organisationId}/users/me`, params),
  ]);

  return dedupeTemplates(
    [libraryResult, organisationResult, userResult].flatMap((result) =>
      result.status === 'fulfilled' ? result.value : []
    )
  );
};

const SOAP_FIELD_BY_KEYWORD: Array<{
  field: keyof NonNullable<SoapTemplate['content']>;
  keywords: string[];
}> = [
  { field: 'chiefComplaint', keywords: ['chief', 'complaint', 'presenting', 'reason'] },
  { field: 'subjective', keywords: ['subjective', 'history'] },
  { field: 'objective', keywords: ['objective', 'examination', 'exam', 'vitals', 'findings'] },
  { field: 'assessment', keywords: ['assessment', 'differential', 'diagnosis'] },
  { field: 'plan', keywords: ['plan', 'treatment', 'next steps'] },
];

/** Map a section/field title to one of the four S/O/A/P fields by keyword. */
const soapFieldForTitle = (
  title: string
): keyof NonNullable<SoapTemplate['content']> | undefined => {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return undefined;
  return SOAP_FIELD_BY_KEYWORD.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  )?.field;
};

const hasSchemaSnapshot = (value: unknown): value is TemplateSchemaSnapshot =>
  Boolean(
    value && typeof value === 'object' && Array.isArray((value as { sections?: unknown }).sections)
  );

const soapSchemaSnapshot = (template: TemplateLike): TemplateSchemaSnapshot | undefined => {
  const root = (template as TemplateLike & { schemaSnapshot?: unknown }).schemaSnapshot;
  if (hasSchemaSnapshot(root)) return root;
  const version = template.versions?.find(
    (item) => item.version === template.publishedVersion || item.version === template.latestVersion
  );
  return hasSchemaSnapshot(version?.schemaSnapshot) ? version.schemaSnapshot : undefined;
};

const SOAP_CONTENT_KEYS = CANONICAL_SOAP_FIELD_KEYS;

const isSoapContentKey = (key: string): key is keyof NonNullable<SoapTemplate['content']> =>
  (SOAP_CONTENT_KEYS as readonly string[]).includes(key);

/**
 * Build the prefill content for the four S/O/A/P editors from a template schema
 * snapshot. Canonical templates expose fields keyed exactly by `chiefComplaint`/
 * `subjective`/`objective`/`assessment`/`plan`, so we map by field key first (any
 * section), carrying the authored rich-text default value through losslessly. Legacy
 * templates whose field keys don't match fall back to keyword-by-section-title mapping,
 * preserving prior behaviour. This keeps the builder, resolver seed, and workspace
 * editors single-sourced — selecting/resolving a template hydrates content with no
 * section dropped.
 */
type SoapContent = NonNullable<SoapTemplate['content']>;

// 1) Canonical field-key mapping (any section). Carries authored rich-text content as-is.
const applyCanonicalFieldContent = (
  content: SoapContent,
  sections: NonNullable<TemplateSchemaSnapshot['sections']>
): void => {
  for (const section of sections) {
    for (const definition of section.fields ?? []) {
      if (!isSoapContentKey(definition.key)) continue;
      const value = definition.defaultValue;
      if (typeof value === 'string' && value.trim()) {
        content[definition.key] = (content[definition.key] ?? '') + value;
      }
    }
  }
};

const fieldDefaultToBody = (definition: { defaultValue?: unknown; label?: string }): string => {
  const value = definition.defaultValue;
  if (typeof value === 'string' && value.trim()) return value;
  return definition.label ? `<p>${definition.label}</p>` : '';
};

// 2) Keyword-by-title fallback for legacy templates without canonical field keys.
const applyTitleKeywordContent = (
  content: SoapContent,
  sections: NonNullable<TemplateSchemaSnapshot['sections']>
): void => {
  for (const section of sections) {
    const field = soapFieldForTitle(section.title);
    if (!field || content[field]) continue;
    const body = (section.fields ?? [])
      .filter((definition) => !isSoapContentKey(definition.key))
      .map(fieldDefaultToBody)
      .filter(Boolean)
      .join('');
    if (body) content[field] = (content[field] ?? '') + body;
  }
};

export const schemaSnapshotToSoapContent = (
  snapshot: TemplateSchemaSnapshot | undefined
): SoapTemplate['content'] => {
  const sections = snapshot?.sections ?? [];
  if (sections.length === 0) return undefined;
  const content: SoapContent = {};

  applyCanonicalFieldContent(content, sections);
  applyTitleKeywordContent(content, sections);

  return Object.keys(content).length > 0 ? content : undefined;
};

const SOAP_KEY_SET = new Set<string>(CANONICAL_SOAP_FIELD_KEYS);

/**
 * A SOAP template is CUSTOM (structure-overriding) when it carries fields but NONE of them map
 * onto the native four S/O/A/P editors — neither by canonical field key (chiefComplaint /
 * subjective / objective / assessment / plan) nor by a section title that keyword-maps to one.
 * Native (YC-default) snapshots map cleanly onto the editors and only swap content; a snapshot
 * with a genuinely different structure replaces it.
 */
const isCustomSoapSnapshot = (snapshot: TemplateSchemaSnapshot | undefined): boolean => {
  const sections = snapshot?.sections ?? [];
  const hasFields = sections.some((section) => (section.fields ?? []).length > 0);
  if (!hasFields) return false;
  const mapsToNativeSoap = sections.some(
    (section) =>
      (section.fields ?? []).some((field) => SOAP_KEY_SET.has(field.key)) ||
      Boolean(soapFieldForTitle(section.title))
  );
  return !mapsToNativeSoap;
};

/** Convert a custom SOAP snapshot to renderable FormFields; undefined when the snapshot is native. */
const soapCustomSchema = (snapshot: TemplateSchemaSnapshot | undefined): FormField[] | undefined =>
  snapshot && isCustomSoapSnapshot(snapshot) ? templateSchemaToFormFields(snapshot) : undefined;

export const templateToSoapTemplate = (template: TemplateLike): SoapTemplate => {
  const snapshot = soapSchemaSnapshot(template);
  const customSchema = soapCustomSchema(snapshot);
  return {
    id: template.id,
    name: template.name,
    serviceId: template.catalogItemIds?.[0],
    isDefault: template.ownership === 'YC_LIBRARY',
    version: template.publishedVersion ?? template.latestVersion ?? undefined,
    // Custom templates swap structure (render their fields); native templates swap content only.
    customSchema,
    content: customSchema ? undefined : schemaSnapshotToSoapContent(snapshot),
  };
};

/**
 * Resolve the SOAP template that best matches the encounter context via the shared
 * `GET /pms/resolve` endpoint (kind `SOAP_NOTE`). Returns the resolved template as a
 * `SoapTemplate` (content snapshot + version) or `null` when none is configured —
 * the backend answers 404, which we treat as "no default", so the editor stays blank.
 */
export const resolveSoapTemplate = async (
  context: TemplateResolveContext
): Promise<SoapTemplate | null> => {
  const params: Record<string, string> = {
    organisationId: context.organisationId,
    kind: 'SOAP_NOTE',
  };
  if (context.appointmentId) params.appointmentId = context.appointmentId;
  if (context.encounterId) params.encounterId = context.encounterId;
  if (context.companionId) params.companionId = context.companionId;
  if (context.species) params.species = context.species;
  if (context.serviceId) params.serviceId = context.serviceId;
  if (context.packageId) params.packageId = context.packageId;
  if (context.mode) params.mode = context.mode;

  try {
    const res = await getData<TemplateResolveResponse>('/v1/templates/pms/resolve', params);
    const resolved = res.data;
    if (!resolved?.templateId) return null;
    const customSchema = soapCustomSchema(resolved.schemaSnapshot);
    return {
      id: resolved.templateId,
      name: resolved.name,
      isDefault: resolved.source === 'YC_LIBRARY',
      version: resolved.templateVersion,
      versionId: resolved.templateVersionId,
      // Custom resolved templates swap structure; native ones swap content into the editors.
      customSchema,
      content: customSchema ? undefined : schemaSnapshotToSoapContent(resolved.schemaSnapshot),
    };
  } catch {
    return null;
  }
};

export const listSoapTemplatesForWorkspace = async (
  organisationId: string
): Promise<SoapTemplate[]> => {
  const templates = await listWorkspaceTemplates(organisationId, {
    kind: 'SOAP_NOTE',
    status: 'PUBLISHED',
  });
  return templates.map(templateToSoapTemplate);
};

export const listInpatientScheduleTemplates = async (organisationId: string) =>
  listWorkspaceTemplates(organisationId, {
    kind: 'INPATIENT_SCHEDULE',
    status: 'PUBLISHED',
  });

export const listVitalsTemplates = async (organisationId: string) =>
  listWorkspaceTemplates(organisationId, {
    kind: 'VITAL_RECORD',
    status: 'PUBLISHED',
  });

export const listDischargeSummaryTemplates = async (organisationId: string) =>
  listWorkspaceTemplates(organisationId, {
    kind: 'DISCHARGE_SUMMARY',
    status: 'PUBLISHED',
  });

export type TemplateResolveContext = {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
  companionId?: string;
  species?: string;
  serviceId?: string;
  packageId?: string;
  mode?: 'OUTPATIENT' | 'INPATIENT';
};

/**
 * Resolve the discharge-summary template that best matches the encounter context
 * (service / package / species / mode) via the shared `GET /pms/resolve` endpoint.
 * Returns the resolved template (content snapshot + `templateId`/`templateVersion`)
 * or `null` when no template is configured — the backend answers 404 in that case,
 * which we treat as "no default template" so callers fall back to a blank editor.
 */
export const resolveDischargeTemplate = async (
  context: TemplateResolveContext
): Promise<TemplateResolveResponse | null> => {
  const params: Record<string, string> = {
    organisationId: context.organisationId,
    kind: 'DISCHARGE_SUMMARY',
  };
  if (context.appointmentId) params.appointmentId = context.appointmentId;
  if (context.encounterId) params.encounterId = context.encounterId;
  if (context.companionId) params.companionId = context.companionId;
  if (context.species) params.species = context.species;
  if (context.serviceId) params.serviceId = context.serviceId;
  if (context.packageId) params.packageId = context.packageId;
  if (context.mode) params.mode = context.mode;

  try {
    const res = await getData<TemplateResolveResponse>('/v1/templates/pms/resolve', params);
    return res.data ?? null;
  } catch {
    // 404 (no template configured for this context) and any transient resolve
    // failure fall back to a blank discharge editor rather than blocking the step.
    return null;
  }
};

export const getWorkspaceTemplateById = async (organisationId: string, templateId: string) => {
  const res = await getData<TemplateLike>(
    `/v1/templates/pms/templates/organisation/${organisationId}/${templateId}`
  );
  return res.data;
};

export const updateWorkspaceTemplateCatalogLinks = async (
  organisationId: string,
  templateId: string,
  catalogItemIds: string[]
) => {
  const res = await patchData<TemplateLike, { catalogItemIds: string[] }>(
    `/v1/templates/pms/templates/organisation/${organisationId}/${templateId}/catalog-links`,
    { catalogItemIds }
  );
  return res.data;
};

export const createWorkspaceTemplateInstance = async (
  organisationId: string,
  templateId: string,
  input: Omit<TemplateInstanceUpsertInput, 'organisationId'>
) => {
  const res = await postData<TemplateInstanceLike>(
    `/v1/templates/pms/templates/organisation/${organisationId}/${templateId}/instances`,
    { ...input, organisationId }
  );
  return res.data;
};

export const updateWorkspaceTemplateInstance = async (
  organisationId: string,
  instanceId: string,
  input: Partial<TemplateInstanceUpsertInput>
) => {
  const res = await patchData<TemplateInstanceLike, Partial<TemplateInstanceUpsertInput>>(
    `/v1/templates/pms/template-instances/organisation/${organisationId}/${instanceId}`,
    input
  );
  return res.data;
};

export const submitWorkspaceTemplateInstance = async (
  organisationId: string,
  instanceId: string
) => {
  const res = await postData<TemplateInstanceLike>(
    `/v1/templates/pms/template-instances/organisation/${organisationId}/${instanceId}/submit`
  );
  return res.data;
};

const parametersBody = (options: { force?: boolean; notify?: boolean; deferUntil?: string }) => ({
  resourceType: 'Parameters',
  parameter: [
    ...(options.force === undefined ? [] : [{ name: 'force', valueBoolean: options.force }]),
    ...(options.notify === undefined ? [] : [{ name: 'notify', valueBoolean: options.notify }]),
    ...(options.deferUntil === undefined
      ? []
      : [{ name: 'deferUntil', valueDateTime: options.deferUntil }]),
  ],
});

export const applyInpatientScheduleTemplate = async (
  organisationId: string,
  instanceId: string,
  options: { force?: boolean; notify?: boolean; deferUntil?: string } = {}
) => {
  const res = await postData<FhirTask>(
    `/fhir/v1/task-schedule/organisation/${organisationId}/template-instance/${instanceId}/$apply`,
    parametersBody(options)
  );
  return res.data;
};

export const getInpatientScheduleForEncounter = async (
  organisationId: string,
  encounterId: string
) => {
  const res = await getData<FhirTask>(
    `/fhir/v1/task-schedule/organisation/${organisationId}/encounter/${encounterId}`
  );
  return res.data;
};

const taskScheduleAction = async (
  organisationId: string,
  instanceId: string,
  action: '$pause' | '$resume' | '$cancel' | '$regenerate',
  options: { notify?: boolean; deferUntil?: string } = {}
) => {
  const res = await postData<FhirTask>(
    `/fhir/v1/task-schedule/organisation/${organisationId}/template-instance/${instanceId}/${action}`,
    parametersBody(options)
  );
  return res.data;
};

export const pauseInpatientScheduleTemplate = (
  organisationId: string,
  instanceId: string,
  options: { notify?: boolean; deferUntil?: string } = {}
) => taskScheduleAction(organisationId, instanceId, '$pause', options);

export const resumeInpatientScheduleTemplate = (
  organisationId: string,
  instanceId: string,
  options: { notify?: boolean; deferUntil?: string } = {}
) => taskScheduleAction(organisationId, instanceId, '$resume', options);

export const cancelInpatientScheduleTemplate = (
  organisationId: string,
  instanceId: string,
  options: { notify?: boolean; deferUntil?: string } = {}
) => taskScheduleAction(organisationId, instanceId, '$cancel', options);

export const regenerateInpatientScheduleTemplate = (
  organisationId: string,
  instanceId: string,
  options: { notify?: boolean; deferUntil?: string } = {}
) => taskScheduleAction(organisationId, instanceId, '$regenerate', options);
