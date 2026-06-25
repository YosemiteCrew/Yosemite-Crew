import type { TemplateLike } from '@yosemite-crew/types';
import {
  applyInpatientScheduleTemplate,
  cancelInpatientScheduleTemplate,
  createWorkspaceTemplateInstance,
  extractFollowUpInDays,
  schemaSnapshotToPrescriptionItems,
  getWorkspaceTemplateById,
  getInpatientScheduleForEncounter,
  listDischargeSummaryTemplates,
  listSoapTemplatesForWorkspace,
  listVitalsTemplates,
  listWorkspaceTemplates,
  pauseInpatientScheduleTemplate,
  regenerateInpatientScheduleTemplate,
  resolveSoapTemplate,
  resumeInpatientScheduleTemplate,
  submitWorkspaceTemplateInstance,
  templateToSoapTemplate,
  updateWorkspaceTemplateCatalogLinks,
  updateWorkspaceTemplateInstance,
} from '@/app/features/appointments/services/workspaceTemplateService';

const getDataMock = jest.fn();
const patchDataMock = jest.fn();
const postDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  getData: (...args: unknown[]) => getDataMock(...args),
  patchData: (...args: unknown[]) => patchDataMock(...args),
  postData: (...args: unknown[]) => postDataMock(...args),
}));

const template = (id: string, name = id): TemplateLike => ({
  id,
  organisationId: 'org-1',
  ownerUserId: null,
  ownership: 'ORG_TEMPLATE',
  kind: 'SOAP_NOTE',
  name,
  description: null,
  status: 'PUBLISHED',
  scope: 'ORGANISATION',
  rules: {},
  latestVersion: 1,
  publishedVersion: 1,
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: new Date('2026-04-20T09:00:00.000Z'),
  updatedAt: new Date('2026-04-20T09:00:00.000Z'),
  catalogItemIds: ['svc-1'],
});

describe('workspaceTemplateService', () => {
  beforeEach(() => {
    getDataMock.mockReset();
    patchDataMock.mockReset();
    postDataMock.mockReset();
  });

  it('loads library, organisation, and user templates and deduplicates by id', async () => {
    getDataMock
      .mockResolvedValueOnce({ data: [template('tpl-1', 'YC SOAP')] })
      .mockResolvedValueOnce({
        data: [template('tpl-1', 'YC SOAP'), template('tpl-2', 'Org SOAP')],
      })
      .mockResolvedValueOnce({ data: [template('tpl-3', 'My SOAP')] });

    const templates = await listWorkspaceTemplates('org-1', {
      kind: 'SOAP_NOTE',
      status: 'PUBLISHED',
    });

    expect(getDataMock).toHaveBeenNthCalledWith(1, '/v1/templates/pms/templates/library', {
      kind: 'SOAP_NOTE',
      status: 'PUBLISHED',
    });
    expect(getDataMock).toHaveBeenNthCalledWith(
      2,
      '/v1/templates/pms/templates/organisation/org-1',
      { kind: 'SOAP_NOTE', status: 'PUBLISHED' }
    );
    expect(getDataMock).toHaveBeenNthCalledWith(
      3,
      '/v1/templates/pms/templates/organisation/org-1/users/me',
      { kind: 'SOAP_NOTE', status: 'PUBLISHED' }
    );
    expect(templates.map((item) => item.id)).toEqual(['tpl-1', 'tpl-2', 'tpl-3']);
  });

  it('returns available templates when one source fails', async () => {
    getDataMock
      .mockRejectedValueOnce(new Error('library down'))
      .mockResolvedValueOnce({ data: [template('tpl-2', 'Org SOAP')] })
      .mockResolvedValueOnce({ data: [] });

    await expect(listSoapTemplatesForWorkspace('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'tpl-2', name: 'Org SOAP' }),
    ]);
  });

  it('loads published vitals templates for workspace record flows', async () => {
    getDataMock
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{ ...template('tpl-vitals', 'Vitals'), kind: 'VITAL_RECORD' }],
      })
      .mockResolvedValueOnce({ data: [] });

    await expect(listVitalsTemplates('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'tpl-vitals', kind: 'VITAL_RECORD' }),
    ]);

    expect(getDataMock).toHaveBeenNthCalledWith(1, '/v1/templates/pms/templates/library', {
      kind: 'VITAL_RECORD',
      status: 'PUBLISHED',
    });
  });

  it('loads published discharge summary templates for workspace summary flows', async () => {
    getDataMock
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{ ...template('tpl-discharge', 'Discharge'), kind: 'DISCHARGE_SUMMARY' }],
      })
      .mockResolvedValueOnce({ data: [] });

    await expect(listDischargeSummaryTemplates('org-1')).resolves.toEqual([
      expect.objectContaining({ id: 'tpl-discharge', kind: 'DISCHARGE_SUMMARY' }),
    ]);

    expect(getDataMock).toHaveBeenNthCalledWith(1, '/v1/templates/pms/templates/library', {
      kind: 'DISCHARGE_SUMMARY',
      status: 'PUBLISHED',
    });
  });

  it('maps backend templates to SOAP template options', () => {
    expect(templateToSoapTemplate({ ...template('tpl-yc'), ownership: 'YC_LIBRARY' })).toEqual({
      id: 'tpl-yc',
      name: 'tpl-yc',
      serviceId: 'svc-1',
      isDefault: true,
      version: 1,
      content: undefined,
    });
  });

  it('prefills S/O/A/P content from a template schema snapshot', () => {
    const withSchema = {
      ...template('tpl-content'),
      schemaSnapshot: {
        sections: [
          {
            id: 's1',
            title: 'Subjective History',
            fields: [{ key: 'subj', label: 'History', type: 'richtext' }],
          },
          {
            id: 's2',
            title: 'Plan',
            fields: [{ key: 'plan', label: 'Plan', type: 'richtext', defaultValue: '<p>Rx</p>' }],
          },
          {
            id: 's3',
            title: 'Unmapped section',
            fields: [{ key: 'x', label: 'X', type: 'text' }],
          },
        ],
      },
    } as unknown as TemplateLike;
    const mapped = templateToSoapTemplate(withSchema);
    expect(mapped.content?.subjective).toBe('<p>History</p>');
    // defaultValue wins over the label fallback.
    expect(mapped.content?.plan).toBe('<p>Rx</p>');
    // Sections that map to no S/O/A/P field are ignored.
    expect(mapped.content?.objective).toBeUndefined();
  });

  it('resolves the SOAP template for an encounter context', async () => {
    getDataMock.mockResolvedValueOnce({
      data: {
        templateId: 'tpl-resolved',
        templateVersion: 3,
        name: 'Resolved SOAP',
        source: 'ORG_LINKED',
        schemaSnapshot: {
          sections: [
            { id: 'a', title: 'Assessment', fields: [{ key: 'a', label: 'Dx', type: 'text' }] },
          ],
        },
      },
    });

    const resolved = await resolveSoapTemplate({
      organisationId: 'org-1',
      appointmentId: 'appt-1',
      serviceId: 'svc-1',
      mode: 'OUTPATIENT',
    });

    expect(getDataMock).toHaveBeenCalledWith('/v1/templates/pms/resolve', {
      organisationId: 'org-1',
      kind: 'SOAP_NOTE',
      appointmentId: 'appt-1',
      serviceId: 'svc-1',
      mode: 'OUTPATIENT',
    });
    expect(resolved).toMatchObject({
      id: 'tpl-resolved',
      version: 3,
      isDefault: false,
    });
    expect(resolved?.content?.assessment).toBe('<p>Dx</p>');
  });

  it('classifies a custom (non-S/O/A/P) template as a structure override', () => {
    const customTpl = {
      ...template('tpl-custom'),
      schemaSnapshot: {
        sections: [
          {
            id: 'ortho',
            title: 'Mobility scoring',
            fields: [
              { key: 'gaitScore', label: 'Gait score', type: 'number' },
              { key: 'lameness', label: 'Lameness', type: 'text' },
            ],
          },
        ],
      },
    } as unknown as TemplateLike;
    const mapped = templateToSoapTemplate(customTpl);
    // Custom templates swap STRUCTURE: no native content, a renderable schema instead.
    expect(mapped.content).toBeUndefined();
    expect(mapped.customSchema).toBeDefined();
    expect(mapped.customSchema?.[0]?.type).toBe('group');
    const leaves = (mapped.customSchema?.[0] as { fields?: Array<{ id: string }> }).fields ?? [];
    expect(leaves.map((f) => f.id)).toEqual(['gaitScore', 'lameness']);
  });

  it('keeps a native S/O/A/P template as content-only (no structure override)', () => {
    const nativeTpl = {
      ...template('tpl-native'),
      schemaSnapshot: {
        sections: [
          {
            id: 'subjective',
            title: 'Subjective',
            fields: [{ key: 'subjective', label: 'Subjective', type: 'richText' }],
          },
        ],
      },
    } as unknown as TemplateLike;
    const mapped = templateToSoapTemplate(nativeTpl);
    expect(mapped.customSchema).toBeUndefined();
  });

  it('resolves a custom template as a structure override with provenance', async () => {
    getDataMock.mockResolvedValueOnce({
      data: {
        templateId: 'tpl-custom-resolved',
        templateVersion: 2,
        templateVersionId: 'ver-2',
        name: 'Ortho SOAP',
        source: 'USER_LINKED',
        schemaSnapshot: {
          sections: [
            {
              id: 'ortho',
              title: 'Mobility scoring',
              fields: [{ key: 'gaitScore', label: 'Gait score', type: 'number' }],
            },
          ],
        },
      },
    });
    const resolved = await resolveSoapTemplate({ organisationId: 'org-1' });
    expect(resolved?.customSchema).toBeDefined();
    expect(resolved?.content).toBeUndefined();
    expect(resolved?.versionId).toBe('ver-2');
  });

  it('returns null when no SOAP template is configured (404)', async () => {
    getDataMock.mockRejectedValueOnce(new Error('not found'));
    await expect(resolveSoapTemplate({ organisationId: 'org-1' })).resolves.toBeNull();
  });

  it('returns null when the resolver responds without a templateId', async () => {
    getDataMock.mockResolvedValueOnce({ data: { name: 'empty' } });
    await expect(resolveSoapTemplate({ organisationId: 'org-1' })).resolves.toBeNull();
  });

  it('loads a single workspace template by id', async () => {
    getDataMock.mockResolvedValueOnce({ data: template('tpl-1', 'SOAP') });

    await expect(getWorkspaceTemplateById('org-1', 'tpl-1')).resolves.toEqual(
      expect.objectContaining({ id: 'tpl-1' })
    );

    expect(getDataMock).toHaveBeenCalledWith(
      '/v1/templates/pms/templates/organisation/org-1/tpl-1'
    );
  });

  it('updates catalog links for a workspace template', async () => {
    patchDataMock.mockResolvedValueOnce({
      data: { ...template('tpl-1'), catalogItemIds: ['svc-2'] },
    });

    await updateWorkspaceTemplateCatalogLinks('org-1', 'tpl-1', ['svc-2']);

    expect(patchDataMock).toHaveBeenCalledWith(
      '/v1/templates/pms/templates/organisation/org-1/tpl-1/catalog-links',
      { catalogItemIds: ['svc-2'] }
    );
  });

  it('creates a template instance for workspace schedule application', async () => {
    postDataMock.mockResolvedValueOnce({
      data: { id: 'instance-1', templateId: 'tpl-1', organisationId: 'org-1' },
    });

    const instance = await createWorkspaceTemplateInstance('org-1', 'tpl-1', {
      appointmentId: 'appt-1',
      encounterId: 'enc-1',
      authorId: 'user-1',
      data: {},
      status: 'DRAFT',
    });

    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/templates/pms/templates/organisation/org-1/tpl-1/instances',
      {
        organisationId: 'org-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        authorId: 'user-1',
        data: {},
        status: 'DRAFT',
      }
    );
    expect(instance.id).toBe('instance-1');
  });

  it('updates and submits a workspace template instance', async () => {
    patchDataMock.mockResolvedValueOnce({
      data: { id: 'instance-1', templateId: 'tpl-1', status: 'IN_PROGRESS' },
    });
    postDataMock.mockResolvedValueOnce({
      data: { id: 'instance-1', templateId: 'tpl-1', status: 'SUBMITTED' },
    });

    await updateWorkspaceTemplateInstance('org-1', 'instance-1', {
      data: { subjective: { chiefComplaint: 'Vomiting' } },
      status: 'IN_PROGRESS',
    });
    await submitWorkspaceTemplateInstance('org-1', 'instance-1');

    expect(patchDataMock).toHaveBeenCalledWith(
      '/v1/templates/pms/template-instances/organisation/org-1/instance-1',
      {
        data: { subjective: { chiefComplaint: 'Vomiting' } },
        status: 'IN_PROGRESS',
      }
    );
    expect(postDataMock).toHaveBeenCalledWith(
      '/v1/templates/pms/template-instances/organisation/org-1/instance-1/submit'
    );
  });

  it('applies an inpatient schedule template instance through FHIR Parameters', async () => {
    postDataMock.mockResolvedValueOnce({ data: { resourceType: 'Task', id: 'schedule-1' } });

    await applyInpatientScheduleTemplate('org-1', 'instance-1', {
      force: true,
      notify: false,
      deferUntil: '2026-04-25T09:00:00.000Z',
    });

    expect(postDataMock).toHaveBeenCalledWith(
      '/fhir/v1/task-schedule/organisation/org-1/template-instance/instance-1/$apply',
      {
        resourceType: 'Parameters',
        parameter: [
          { name: 'force', valueBoolean: true },
          { name: 'notify', valueBoolean: false },
          { name: 'deferUntil', valueDateTime: '2026-04-25T09:00:00.000Z' },
        ],
      }
    );
  });

  it('calls schedule lifecycle operations through FHIR task-schedule endpoints', async () => {
    postDataMock.mockResolvedValue({ data: { resourceType: 'Task', id: 'schedule-1' } });

    await pauseInpatientScheduleTemplate('org-1', 'instance-1');
    await resumeInpatientScheduleTemplate('org-1', 'instance-1', { notify: true });
    await cancelInpatientScheduleTemplate('org-1', 'instance-1');
    await regenerateInpatientScheduleTemplate('org-1', 'instance-1', {
      deferUntil: '2026-04-25T09:00:00.000Z',
    });

    expect(postDataMock).toHaveBeenNthCalledWith(
      1,
      '/fhir/v1/task-schedule/organisation/org-1/template-instance/instance-1/$pause',
      { resourceType: 'Parameters', parameter: [] }
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      2,
      '/fhir/v1/task-schedule/organisation/org-1/template-instance/instance-1/$resume',
      { resourceType: 'Parameters', parameter: [{ name: 'notify', valueBoolean: true }] }
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      3,
      '/fhir/v1/task-schedule/organisation/org-1/template-instance/instance-1/$cancel',
      { resourceType: 'Parameters', parameter: [] }
    );
    expect(postDataMock).toHaveBeenNthCalledWith(
      4,
      '/fhir/v1/task-schedule/organisation/org-1/template-instance/instance-1/$regenerate',
      {
        resourceType: 'Parameters',
        parameter: [{ name: 'deferUntil', valueDateTime: '2026-04-25T09:00:00.000Z' }],
      }
    );
  });

  it('calls encounter schedule read endpoint', async () => {
    getDataMock.mockResolvedValueOnce({ data: { resourceType: 'Task', id: 'schedule-1' } });

    await getInpatientScheduleForEncounter('org-1', 'enc-1');

    expect(getDataMock).toHaveBeenCalledWith(
      '/fhir/v1/task-schedule/organisation/org-1/encounter/enc-1'
    );
    expect(postDataMock).not.toHaveBeenCalled();
  });

  describe('extractFollowUpInDays', () => {
    const withFollowUp = (defaultValue: unknown) => ({
      sections: [
        {
          id: 'follow_up',
          title: 'Follow up',
          fields: [
            { key: 'followUpInDays', label: 'Follow up in (days)', type: 'number', defaultValue },
          ],
        },
      ],
    });

    it('reads a positive numeric follow-up value', () => {
      expect(extractFollowUpInDays(withFollowUp(7) as never)).toBe(7);
    });

    it('coerces a numeric string', () => {
      expect(extractFollowUpInDays(withFollowUp('14') as never)).toBe(14);
    });

    it('returns undefined for missing, zero, or non-numeric values', () => {
      expect(extractFollowUpInDays(undefined)).toBeUndefined();
      expect(extractFollowUpInDays(withFollowUp(0) as never)).toBeUndefined();
      expect(extractFollowUpInDays(withFollowUp('soon') as never)).toBeUndefined();
      expect(extractFollowUpInDays({ sections: [] } as never)).toBeUndefined();
    });
  });

  describe('schemaSnapshotToPrescriptionItems', () => {
    const medField = (key: string, inventoryItemId: string, defaultValue?: unknown) => ({
      key,
      label: key,
      type: 'text',
      defaultValue,
      rules: { inventoryItemId },
    });

    it('groups medication fields by inventory id and maps role-by-key-suffix with defaults', () => {
      const snapshot = {
        sections: [
          {
            id: 'medications',
            title: 'Medications',
            fields: [
              medField('g_med_1_name', 'inv-1', 'Gabapentin'),
              medField('g_med_1_dosage', 'inv-1', '100mg'),
              medField('g_med_1_route', 'inv-1', 'Oral'),
              medField('g_med_1_frequency', 'inv-1', '2x daily'),
              medField('g_med_1_duration', 'inv-1', '7'),
              medField('g_med_1_remark', 'inv-1', 'With food'),
            ],
          },
        ],
      };

      expect(schemaSnapshotToPrescriptionItems(snapshot as never)).toEqual([
        {
          medicineName: 'Gabapentin',
          dosage: '100mg',
          route: 'Oral',
          frequency: '2x daily',
          durationDays: '7',
          instructions: 'With food',
          fulfillment: 'IN_HOUSE',
          inventoryItemId: 'inv-1',
        },
      ]);
    });

    it('ignores fields without an inventory id and rows without a name', () => {
      const snapshot = {
        sections: [
          {
            id: 'medications',
            title: 'Medications',
            fields: [
              { key: 'note', label: 'Note', type: 'text', defaultValue: 'x' },
              medField('g_med_1_dosage', 'inv-2', '50mg'),
            ],
          },
        ],
      };
      expect(schemaSnapshotToPrescriptionItems(snapshot as never)).toEqual([]);
      expect(schemaSnapshotToPrescriptionItems(undefined)).toEqual([]);
    });
  });
});
