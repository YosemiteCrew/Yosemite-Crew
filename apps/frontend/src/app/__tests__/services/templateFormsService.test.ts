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

  it('saves an edited library template as a new organisation copy', async () => {
    (postData as jest.Mock).mockResolvedValue({ data: { id: 'tpl-copy', name: 'SOAP' } });

    await saveTemplateFormDraft(
      {
        _id: 'lib-1',
        templateId: 'lib-1',
        templateSource: 'YC_LIBRARY',
        name: 'SOAP',
        category: 'SOAP',
        usage: 'Internal',
        updatedBy: '',
        lastUpdated: '',
        schema: [],
      } as unknown as FormsProps,
      'org-1'
    );

    // The library id must not be PATCHed: that record is shared and is not
    // writable from an organisation route.
    expect(patchData).not.toHaveBeenCalledWith(expect.stringContaining('lib-1'), expect.anything());
    expect(postData).toHaveBeenCalledWith(
      '/v1/templates/pms/templates',
      expect.objectContaining({ organisationId: 'org-1' })
    );
  });

  it('syncs catalog links after saving when services are selected', async () => {
    (postData as jest.Mock).mockResolvedValue({ data: { id: 'tpl-new', name: 'SOAP' } });
    (patchData as jest.Mock).mockResolvedValue({
      data: { id: 'tpl-new', name: 'SOAP', catalogItemIds: ['svc-1'] },
    });

    await saveTemplateFormDraft(
      {
        name: 'SOAP',
        category: 'SOAP',
        usage: 'Internal',
        updatedBy: '',
        lastUpdated: '',
        schema: [],
        services: ['svc-1'],
      },
      'org-1'
    );

    expect(patchData).toHaveBeenCalledWith(
      '/v1/templates/pms/templates/organisation/org-1/tpl-new/catalog-links',
      { catalogItemIds: ['svc-1'] }
    );
  });

  // A library starting point is persisted as an organisation template, so its
  // catalog links belong to the caller's org and must be synced like any other.
  it('never posts YC_LIBRARY ownership and still syncs catalog links', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: {
        id: 'tpl-new',
        name: 'SOAP',
        ownership: 'ORG_TEMPLATE',
        source: 'ORGANISATION',
      },
    });

    await saveTemplateFormDraft(
      {
        name: 'SOAP',
        category: 'SOAP',
        usage: 'Internal',
        updatedBy: '',
        lastUpdated: '',
        schema: [],
        services: ['svc-1'],
        templateSource: 'YC_LIBRARY',
      },
      'org-1'
    );

    const [, body] = (postData as jest.Mock).mock.calls[0] as [
      string,
      { ownership: string; organisationId?: string },
    ];
    expect(body.ownership).toBe('ORG_TEMPLATE');
    expect(body.organisationId).toBe('org-1');

    expect(patchData).toHaveBeenCalledWith(expect.stringContaining('/catalog-links'), {
      catalogItemIds: ['svc-1'],
    });
  });

  it('does not echo a YC_LIBRARY selection back as the stored source', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: {
        id: 'tpl-new',
        name: 'SOAP',
      },
    });

    const result = await saveTemplateFormDraft(
      {
        name: 'SOAP',
        category: 'SOAP',
        usage: 'Internal',
        updatedBy: '',
        lastUpdated: '',
        schema: [],
        templateSource: 'YC_LIBRARY',
      },
      'org-1'
    );

    // What was persisted is an org template; reporting it as library-owned
    // would misdescribe the stored record.
    expect(result.templateSource).not.toBe('YC_LIBRARY');
  });

  it('preserves a selected USER_TEMPLATE ownership when the API response is incomplete', async () => {
    (postData as jest.Mock).mockResolvedValue({
      data: {
        id: 'tpl-new',
        name: 'SOAP',
      },
    });

    const result = await saveTemplateFormDraft(
      {
        name: 'SOAP',
        category: 'SOAP',
        usage: 'Internal',
        updatedBy: '',
        lastUpdated: '',
        schema: [],
        templateSource: 'USER_TEMPLATE',
      },
      'org-1'
    );

    expect(result.templateSource).toBe('USER_TEMPLATE');
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
      expect.objectContaining({
        name: 'Updated SOAP',
        schemaSnapshot: { sections: [] },
      })
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
