import axios from 'axios';
import type { TemplateKind, TemplateLike, TemplateUpsertInput } from '@yosemite-crew/types';
import { deleteData, getData, patchData, postData } from '@/app/services/axios';
import { buildTemplatePayload, mapTemplateToUI } from '@/app/lib/forms';
import type { FormsProps } from '@/app/features/forms/types/forms';
import { useFormsStore } from '@/app/stores/formsStore';

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
    if (template?.id) {
      byId.set(template.id, template);
    }
  }
  return [...byId.values()];
};

export const loadTemplateForms = async (
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

const toTemplateErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? (error.response?.data?.message ?? error.message) : fallback;

type TemplateCreateBody = Omit<TemplateUpsertInput, 'createdBy'>;
type TemplateUpdateBody = Partial<
  Pick<
    TemplateUpsertInput,
    | 'ownership'
    | 'name'
    | 'description'
    | 'scope'
    | 'rules'
    | 'schemaSnapshot'
    | 'renderConfigSnapshot'
    | 'validationSnapshot'
  >
>;

const toUpdateBody = (body: TemplateCreateBody): TemplateUpdateBody => ({
  ownership: body.ownership,
  name: body.name,
  description: body.description,
  scope: body.scope,
  rules: body.rules,
  schemaSnapshot: body.schemaSnapshot,
  renderConfigSnapshot: body.renderConfigSnapshot,
  validationSnapshot: body.validationSnapshot,
});

const preserveSelectedOwnership = (form: FormsProps, template: FormsProps): FormsProps => {
  if (form.templateSource === undefined) {
    return template;
  }

  return {
    ...template,
    templateSource: form.templateSource,
  };
};

export const saveTemplateFormDraft = async (form: FormsProps, organisationId: string) => {
  const { upsertForm, setError } = useFormsStore.getState();
  try {
    const body = buildTemplatePayload(form, organisationId);
    const templateId = form.templateId ?? form._id;
    const res = templateId
      ? await patchData<TemplateLike, TemplateUpdateBody>(
          `/v1/templates/pms/templates/organisation/${organisationId}/${templateId}`,
          toUpdateBody(body)
        )
      : await postData<TemplateLike, TemplateCreateBody>('/v1/templates/pms/templates', body);
    const normalized = preserveSelectedOwnership(form, mapTemplateToUI(res.data));
    upsertForm(normalized);
    // Persist the service/package links so the template resolves into the workspace for the
    // selected catalog items. Until this was wired, the Details step validated a required
    // service but the link was never written (catalog-links endpoint was never called).
    const catalogItemIds = form.services ?? [];
    if (
      catalogItemIds.length > 0 &&
      form.templateSource !== 'YC_LIBRARY' &&
      (normalized.templateId ?? normalized._id)
    ) {
      try {
        return await updateTemplateFormCatalogLinks(normalized, organisationId, catalogItemIds);
      } catch (linkError) {
        // The template itself saved; surface the link failure but don't lose the draft.
        console.error('Failed to sync template catalog links', linkError);
      }
    }
    return normalized;
  } catch (error) {
    setError(toTemplateErrorMessage(error, 'Unable to save template'));
    throw error;
  }
};

export const getTemplateFormById = async (organisationId: string, templateId: string) => {
  const res = await getData<TemplateLike>(
    `/v1/templates/pms/templates/organisation/${organisationId}/${templateId}`
  );
  return mapTemplateToUI(res.data);
};

export const updateTemplateFormCatalogLinks = async (
  form: FormsProps,
  organisationId: string,
  catalogItemIds: string[]
) => {
  const { upsertForm, setError } = useFormsStore.getState();
  const templateId = form.templateId ?? form._id;
  if (!templateId) {
    throw new Error('Template id is required to update catalog links');
  }
  try {
    const res = await patchData<TemplateLike, { catalogItemIds: string[] }>(
      `/v1/templates/pms/templates/organisation/${organisationId}/${templateId}/catalog-links`,
      { catalogItemIds }
    );
    const normalized = preserveSelectedOwnership(form, mapTemplateToUI(res.data));
    upsertForm(normalized);
    return normalized;
  } catch (error) {
    setError(toTemplateErrorMessage(error, 'Unable to update template catalog links'));
    throw error;
  }
};

export const publishTemplateForm = async (form: FormsProps, organisationId: string) => {
  const { upsertForm, setError } = useFormsStore.getState();
  const templateId = form.templateId ?? form._id;
  if (!templateId) {
    throw new Error('Template id is required to publish template');
  }
  try {
    const res = await postData<TemplateLike>(
      `/v1/templates/pms/templates/organisation/${organisationId}/${templateId}/publish`
    );
    const normalized = preserveSelectedOwnership(form, mapTemplateToUI(res.data));
    upsertForm(normalized);
    return normalized;
  } catch (error) {
    setError(toTemplateErrorMessage(error, 'Unable to publish template'));
    throw error;
  }
};

export const unpublishTemplateForm = async (form: FormsProps, organisationId: string) => {
  const { upsertForm, setError } = useFormsStore.getState();
  const templateId = form.templateId ?? form._id;
  if (!templateId) {
    throw new Error('Template id is required to unpublish template');
  }
  try {
    const res = await patchData<TemplateLike, { status: 'DRAFT' }>(
      `/v1/templates/pms/templates/organisation/${organisationId}/${templateId}`,
      { status: 'DRAFT' }
    );
    const normalized = preserveSelectedOwnership(form, mapTemplateToUI(res.data));
    upsertForm(normalized);
    return normalized;
  } catch (error) {
    setError(toTemplateErrorMessage(error, 'Unable to unpublish template'));
    throw error;
  }
};

export const archiveTemplateForm = async (form: FormsProps, organisationId: string) => {
  const { upsertForm, setError } = useFormsStore.getState();
  const templateId = form.templateId ?? form._id;
  if (!templateId) {
    throw new Error('Template id is required to archive template');
  }
  try {
    const res = await deleteData<TemplateLike>(
      `/v1/templates/pms/templates/organisation/${organisationId}/${templateId}`
    );
    const normalized = mapTemplateToUI(res.data);
    upsertForm(normalized);
    return normalized;
  } catch (error) {
    setError(toTemplateErrorMessage(error, 'Unable to archive template'));
    throw error;
  }
};
