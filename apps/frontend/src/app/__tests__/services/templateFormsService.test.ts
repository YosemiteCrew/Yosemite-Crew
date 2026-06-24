import {
  archiveTemplateForm,
  getTemplateFormById,
  loadTemplateForms,
  publishTemplateForm,
  saveTemplateFormDraft,
  unpublishTemplateForm,
  updateTemplateFormCatalogLinks,
} from '@/app/features/forms/services/templateFormsService';
import { deleteData, getData, patchData, postData } from '@/app/services/axios';
import { useFormsStore } from '@/app/stores/formsStore';
import type { FormsProps } from '@/app/features/forms/types/forms';

jest.mock('@/app/services/axios', () => ({
  deleteData: jest.fn(),
  getData: jest.fn(),
  patchData: jest.fn(),
  postData: jest.fn(),
}));

jest.mock('@/app/stores/formsStore', () => ({
  useFormsStore: {
    getState: jest.fn(),
  },
}));

jest.mock('@/app/lib/forms', () => ({
  buildTemplatePayload: jest.fn((form, orgId) => ({
    organisationId: orgId,
    ownership: 'ORG_TEMPLATE',
    kind: form.templateKind ?? 'SOAP_NOTE',
    name: form.name,
    description: form.description,
    scope: 'ORGANISATION',
    rules: {},
    schemaSnapshot: { sections: [] },
    renderConfigSnapshot: {},
    validationSnapshot: {},
  })),
  mapTemplateToUI: jest.fn((template) => ({
    _id: template.id,
    name: template.name,
    isTemplateBacked: true,
  })),
}));

describe('templateFormsService', () => {
  const upsertForm = jest.fn();
  const setError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFormsStore.getState as jest.Mock).mockReturnValue({
      upsertForm,
      setError,
    });
  });

  it('loads YC, organisation, and user templates for the forms module', async () => {
    (getData as jest.Mock)
      .mockResolvedValueOnce({ data: [{ id: 'yc', name: 'YC SOAP' }] })
      .mockResolvedValueOnce({ data: [{ id: 'org', name: 'Org SOAP' }] })
      .mockResolvedValueOnce({ data: [{ id: 'user', name: 'My SOAP' }] });

    const result = await loadTemplateForms('org-1', {
      kind: 'SOAP_NOTE',
      status: 'PUBLISHED',
    });

    expect(getData).toHaveBeenNthCalledWith(1, '/v1/templates/pms/templates/library', {
      kind: 'SOAP_NOTE',
      status: 'PUBLISHED',
    });
    expect(getData).toHaveBeenNthCalledWith(2, '/v1/templates/pms/templates/organisation/org-1', {
      kind: 'SOAP_NOTE',
      status: 'PUBLISHED',
    });
    expect(getData).toHaveBeenNthCalledWith(
      3,
      '/v1/templates/pms/templates/organisation/org-1/users/me',
      { kind: 'SOAP_NOTE', status: 'PUBLISHED' }
    );
    expect(result.map((template) => template.id)).toEqual(['yc', 'org', 'user']);
  });

  it('deduplicates templates by id with later sources winning', async () => {
    (getData as jest.Mock)
      .mockResolvedValueOnce({ data: [{ id: 'tpl', name: 'Library version' }] })
      .mockResolvedValueOnce({ data: [{ id: 'tpl', name: 'Org version' }] })
      .mockResolvedValueOnce({ data: [] });

    const result = await loadTemplateForms('org-1');

    expect(result).toEqual([expect.objectContaining({ id: 'tpl', name: 'Org version' })]);
  });

  it('keeps fulfilled template sources when one source fails', async () => {
    (getData as jest.Mock)
      .mockRejectedValueOnce(new Error('Library unavailable'))
      .mockResolvedValueOnce({ data: [{ id: 'org', name: 'Org template' }] })
      .mockResolvedValueOnce({ data: [] });

    const result = await loadTemplateForms('org-1');

    expect(result).toEqual([expect.objectContaining({ id: 'org' })]);
  });

  it('treats non-array responses as empty source lists', async () => {
    (getData as jest.Mock)
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { id: 'bad' } })
      .mockResolvedValueOnce({ data: [] });

    await expect(loadTemplateForms('org-1')).resolves.toEqual([]);
  });

  it('creates a new template-backed form draft', async () => {
    (postData as jest.Mock).mockResolvedValue({ data: { id: 'tpl-new', name: 'SOAP' } });

    const result = await saveTemplateFormDraft(
      {
        name: 'SOAP',
        category: 'SOAP',
        usage: 'Internal',
        updatedBy: '',
        lastUpdated: '',
        schema: [],
      },
      'org-1'
    );

    expect(postData).toHaveBeenCalledWith(
      '/v1/templates/pms/templates',
      expect.objectContaining({ kind: 'SOAP_NOTE', name: 'SOAP', organisationId: 'org-1' })
    );
    expect(upsertForm).toHaveBeenCalledWith(expect.objectContaining({ _id: 'tpl-new' }));
    expect(result).toEqual(expect.objectContaining({ isTemplateBacked: true }));
  });

  it('updates an existing template-backed form draft', async () => {
    (patchData as jest.Mock).mockResolvedValue({ data: { id: 'tpl-1', name: 'Updated SOAP' } });

    await saveTemplateFormDraft(
      {
        _id: 'tpl-1',
        templateId: 'tpl-1',
        name: 'Updated SOAP',
        category: 'SOAP',
        usage: 'Internal',
        updatedBy: '',
        lastUpdated: '',
        schema: [],
        isTemplateBacked: true,
      },
      'org-1'
    );

    expect(patchData).toHaveBeenCalledWith(
      '/v1/templates/pms/templates/organisation/org-1/tpl-1',
      expect.objectContaining({ name: 'Updated SOAP', schemaSnapshot: { sections: [] } })
    );
  });

  it('loads a template-backed form by id', async () => {
    (getData as jest.Mock).mockResolvedValue({ data: { id: 'tpl-1', name: 'SOAP' } });

    const result = await getTemplateFormById('org-1', 'tpl-1');

    expect(getData).toHaveBeenCalledWith('/v1/templates/pms/templates/organisation/org-1/tpl-1');
    expect(result).toEqual(expect.objectContaining({ _id: 'tpl-1', isTemplateBacked: true }));
  });

  it('updates catalog links for a template-backed form', async () => {
    (patchData as jest.Mock).mockResolvedValue({ data: { id: 'tpl-1', name: 'SOAP' } });
    const form: FormsProps = {
      _id: 'tpl-1',
      templateId: 'tpl-1',
      name: 'SOAP',
      category: 'SOAP',
      usage: 'Internal',
      updatedBy: '',
      lastUpdated: '',
      schema: [],
      isTemplateBacked: true,
    };

    await updateTemplateFormCatalogLinks(form, 'org-1', ['svc-1', 'pkg-1']);

    expect(patchData).toHaveBeenCalledWith(
      '/v1/templates/pms/templates/organisation/org-1/tpl-1/catalog-links',
      { catalogItemIds: ['svc-1', 'pkg-1'] }
    );
    expect(upsertForm).toHaveBeenCalledWith(expect.objectContaining({ _id: 'tpl-1' }));
  });

  it('publishes, unpublishes, and archives template-backed forms', async () => {
    (postData as jest.Mock).mockResolvedValue({ data: { id: 'tpl-1', name: 'Template' } });
    (patchData as jest.Mock).mockResolvedValue({ data: { id: 'tpl-1', name: 'Template' } });
    (deleteData as jest.Mock).mockResolvedValue({ data: { id: 'tpl-1', name: 'Template' } });
    const form: FormsProps = {
      _id: 'tpl-1',
      templateId: 'tpl-1',
      name: 'Template',
      category: 'SOAP',
      usage: 'Internal',
      updatedBy: '',
      lastUpdated: '',
      schema: [],
      isTemplateBacked: true,
    };

    await publishTemplateForm(form, 'org-1');
    await unpublishTemplateForm(form, 'org-1');
    await archiveTemplateForm(form, 'org-1');

    expect(postData).toHaveBeenCalledWith(
      '/v1/templates/pms/templates/organisation/org-1/tpl-1/publish'
    );
    expect(patchData).toHaveBeenCalledWith('/v1/templates/pms/templates/organisation/org-1/tpl-1', {
      status: 'DRAFT',
    });
    expect(deleteData).toHaveBeenCalledWith('/v1/templates/pms/templates/organisation/org-1/tpl-1');
  });
});
