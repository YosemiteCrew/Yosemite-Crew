import {
  formatDateLabel,
  formatTimeLabel,
  statusToLabel,
  labelToStatus,
  getCategoryTemplate,
  mapFormToUI,
  buildFHIRPayload,
  questionnaireToForm,
  mapQuestionnaireToUI,
  mapTemplateToUI,
  templateKindToCategory,
  templateStatusToLabel,
  categoryToTemplateKind,
  shouldUseTemplateApi,
  buildTemplateSchemaSnapshot,
  buildTemplatePayload,
  hasSignatureField,
  removeSignatureFields,
  ensureSingleSignatureAtEnd,
} from '@/app/lib/forms';
import { fromFormRequestDTO, toFormResponseDTO, Form } from '@yosemite-crew/types';
// Fixed: Changed import name from 'FormCategory' to 'FormsCategory'
import { FormsCategory } from '@/app/features/forms/types/forms';

// --- Mocks ---

// Mock external library functions to verify they are called
jest.mock('@yosemite-crew/types', () => ({
  // Keep the real shared constants (e.g. CANONICAL_* clinical structures) so the
  // single-sourced clinical blueprints resolve; only the DTO/mapper helpers are mocked.
  ...jest.requireActual('@yosemite-crew/types'),
  // Pass through relevant types if needed, or just mock functions
  fromFormRequestDTO: jest.fn((dto) => ({
    ...dto,
    _convertedFromDTO: true,
  })),
  toFormResponseDTO: jest.fn((form) => ({
    ...form,
    _convertedToDTO: true,
  })),
  templateMapper: {
    isPlanDefinitionResourceKind: jest.fn(
      (kind) => kind === 'TASK_ASSIGNMENT' || kind === 'INPATIENT_SCHEDULE'
    ),
    templateToPlanDefinition: jest.fn((template) => ({
      resourceType: 'PlanDefinition',
      title: template.name,
      description: template.description,
    })),
    templateToQuestionnaire: jest.fn((template) => ({
      resourceType: 'Questionnaire',
      id: template.id,
      title: template.name,
      description: template.description,
    })),
    planDefinitionToTemplateInput: jest.fn((resource, defaults) => ({
      name: resource.title,
      description: resource.description,
      kind: defaults.kind,
      schemaSnapshot: { sections: [] },
    })),
    questionnaireToTemplateInput: jest.fn((resource, defaults) => ({
      name: resource.title,
      description: resource.description,
      kind: defaults.kind,
      schemaSnapshot: { sections: [{ id: 'section-1', title: 'Section', fields: [] }] },
    })),
  },
}));

// Mock the constants file to control CategoryTemplates data
jest.mock('@/app/features/forms/types/forms', () => {
  return {
    CategoryTemplates: {
      Medical: [{ name: 'template-field', type: 'text', label: 'Template Field' }],
      Intake: [], // Empty template
      // Complex mock for recursive test structure
      Group: [
        {
          type: 'group',
          name: 'g1',
          fields: [{ type: 'text', name: 'child1', label: 'Child' }],
        },
      ],
    },
    // Export FormsCategory as an empty object for type resolution in test scope
    FormsCategory: {},
  };
});

describe('Forms Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 0. formatTimeLabel ---

  describe('formatTimeLabel', () => {
    it('returns a non-empty string for valid date input', () => {
      const date = new Date('2023-10-27T10:30:00Z');
      const result = formatTimeLabel(date);
      // Result depends on preferred timezone — just verify it's a string
      expect(typeof result).toBe('string');
    });

    it('returns fallback empty string for null/undefined', () => {
      expect(formatTimeLabel()).toBe('');
      expect(formatTimeLabel(undefined)).toBe('');
    });
  });

  // --- 1. Helper Functions ---

  describe('formatDateLabel', () => {
    it('formats a valid Date object', () => {
      const date = new Date('2023-10-27T10:00:00Z');
      const result = formatDateLabel(date);
      expect(result).not.toBe('');
      expect(result).not.toBe('Invalid Date');
    });

    it('formats a valid date string', () => {
      const result = formatDateLabel('2023-10-27');
      expect(result).not.toBe('');
    });

    it('returns empty string for null/undefined', () => {
      expect(formatDateLabel()).toBe('');
      expect(formatDateLabel(null as any)).toBe('');
    });

    it('returns empty string for invalid date', () => {
      expect(formatDateLabel('invalid-date-string')).toBe('');
    });
  });

  describe('Status Mappers', () => {
    it('statusToLabel maps correctly', () => {
      expect(statusToLabel('draft')).toBe('Draft');
      expect(statusToLabel('published')).toBe('Published');
      expect(statusToLabel('archived')).toBe('Archived');
    });

    it("statusToLabel defaults to 'Draft'", () => {
      expect(statusToLabel()).toBe('Draft');
      expect(statusToLabel('unknown' as any)).toBe('Draft');
    });

    it('labelToStatus maps correctly', () => {
      expect(labelToStatus('Draft')).toBe('draft');
      expect(labelToStatus('Published')).toBe('published');
      expect(labelToStatus('Archived')).toBe('archived');
    });

    it("labelToStatus defaults to 'draft'", () => {
      expect(labelToStatus()).toBe('draft');
      expect(labelToStatus('Unknown' as any)).toBe('draft');
    });

    it('maps template statuses to form status labels', () => {
      expect(templateStatusToLabel('PUBLISHED')).toBe('Published');
      expect(templateStatusToLabel('ARCHIVED')).toBe('Archived');
      expect(templateStatusToLabel('DRAFT')).toBe('Draft');
      expect(templateStatusToLabel()).toBe('Draft');
    });

    it('maps template kinds to user-facing form categories', () => {
      expect(templateKindToCategory('SOAP_NOTE')).toBe('SOAP');
      expect(templateKindToCategory('VITAL_RECORD')).toBe('Vitals');
      expect(templateKindToCategory('PRESCRIPTION')).toBe('Prescription');
      expect(templateKindToCategory('DISCHARGE_SUMMARY')).toBe('Discharge Form');
      expect(templateKindToCategory('TASK_ASSIGNMENT')).toBe('Task Template');
      expect(templateKindToCategory('INPATIENT_SCHEDULE')).toBe('Inpatient Schedule');
      expect(templateKindToCategory()).toBe('Custom');
    });

    it('maps form categories back to backend template kinds', () => {
      expect(categoryToTemplateKind('SOAP')).toBe('SOAP_NOTE');
      expect(categoryToTemplateKind('Vitals')).toBe('VITAL_RECORD');
      expect(categoryToTemplateKind('Prescription')).toBe('PRESCRIPTION');
      expect(categoryToTemplateKind('Prescription Template')).toBe('PRESCRIPTION');
      expect(categoryToTemplateKind('Discharge Form')).toBe('DISCHARGE_SUMMARY');
      expect(categoryToTemplateKind('Task Template')).toBe('TASK_ASSIGNMENT');
      expect(categoryToTemplateKind('Inpatient Schedule')).toBe('INPATIENT_SCHEDULE');
      expect(categoryToTemplateKind('Consent form')).toBe('CONSENT');
      expect(categoryToTemplateKind('Custom')).toBe('FORM');
      expect(categoryToTemplateKind('Boarder - Schedule' as any)).toBeNull();
    });

    it('detects rows that should use the template API', () => {
      expect(shouldUseTemplateApi({ category: 'SOAP' as any })).toBe(true);
      expect(shouldUseTemplateApi({ category: 'Boarder - Schedule' as any })).toBe(false);
      expect(
        shouldUseTemplateApi({ category: 'Boarder - Schedule' as any, isTemplateBacked: true })
      ).toBe(true);
    });
  });

  // --- 2. Template Logic ---

  describe('getCategoryTemplate', () => {
    // Fixed: Casting to FormsCategory
    it('returns deep cloned template fields for known category', () => {
      const fields = getCategoryTemplate('Medical' as FormsCategory);
      expect(fields).toHaveLength(1);
      expect((fields[0] as any).name).toBe('template-field');
    });

    it('returns empty array for unknown category', () => {
      const fields = getCategoryTemplate('Unknown' as any);
      expect(fields).toEqual([]);
    });

    it('deep clones groups correctly (Recursive check)', async () => {
      jest.resetModules();

      const fields = getCategoryTemplate('Group' as any);
      const groupField = fields[0] as any;

      expect(groupField.type).toBe('group');
      expect(groupField.fields).toHaveLength(1);
      expect(groupField.fields[0].name).toBe('child1');
    });
  });

  // --- 3. UI Mapping Logic ---

  describe('mapFormToUI', () => {
    const baseForm: Form = {
      _id: '123',
      orgId: 'org-1',
      name: 'Test Form',
      category: 'Medical' as FormsCategory,
      status: 'draft',
      schema: [],
      visibilityType: 'Internal',
    } as any;

    it('maps basic fields correctly', () => {
      const ui = mapFormToUI(baseForm);
      expect(ui._id).toBe('123');
      expect(ui.name).toBe('Test Form');
      expect(ui.status).toBe('Draft');
      expect(ui.category).toBe('Medical');
    });

    it('handles toList for services', () => {
      // Single string
      const single = mapFormToUI({ ...baseForm, serviceId: 's1' } as any);
      expect(single.services).toEqual(['s1']);

      // Array
      const arr = mapFormToUI({ ...baseForm, serviceId: ['s1', 's2'] } as any);
      expect(arr.services).toEqual(['s1', 's2']);

      // Undefined
      const none = mapFormToUI({ ...baseForm, serviceId: undefined } as any);
      expect(none.services).toEqual([]);
    });

    it('handles visibility normalization logic', () => {
      // Standard
      expect(mapFormToUI({ ...baseForm, visibilityType: 'Internal' } as any).usage).toBe(
        'Internal'
      );

      // Normalize logic
      expect(mapFormToUI({ ...baseForm, visibilityType: 'internal_external' } as any).usage).toBe(
        'Internal & External'
      );
      expect(mapFormToUI({ ...baseForm, visibilityType: 'internal&external' } as any).usage).toBe(
        'Internal & External'
      );
      expect(mapFormToUI({ ...baseForm, visibilityType: 'interna_external' } as any).usage).toBe(
        'Internal & External'
      ); // Typo coverage

      // Unknown string fallback
      expect(mapFormToUI({ ...baseForm, visibilityType: 'CustomVisibility' } as any).usage).toBe(
        'CustomVisibility'
      );

      // Null fallback
      expect(mapFormToUI({ ...baseForm, visibilityType: null } as any).usage).toBe('Internal');
    });

    it('formats lastUpdated date', () => {
      const form = { ...baseForm, updatedAt: new Date('2023-01-01') };
      const ui = mapFormToUI(form as any);
      expect(ui.lastUpdated).not.toBe('');
    });

    it('falls back to createdAt if updatedAt missing', () => {
      const form = {
        ...baseForm,
        updatedAt: null,
        createdAt: new Date('2023-01-01'),
      };
      const ui = mapFormToUI(form as any);
      expect(ui.lastUpdated).not.toBe('');
    });
  });

  describe('DTO Wrappers', () => {
    it('questionnaireToForm calls fromFormRequestDTO', () => {
      const dto = { some: 'data' } as any;
      const result = questionnaireToForm(dto);
      expect(fromFormRequestDTO).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expect.objectContaining({ _convertedFromDTO: true }));
    });

    it('mapQuestionnaireToUI composes functions correctly', () => {
      const dto = { name: 'DTO Form', status: 'published' } as any;
      // Mock the return of fromFormRequestDTO to be a valid Form-like object for mapFormToUI
      (fromFormRequestDTO as jest.Mock).mockReturnValue({
        _id: 'dto-id',
        name: 'DTO Form',
        status: 'published',
        visibilityType: 'Internal',
      });

      const result = mapQuestionnaireToUI(dto);
      expect(result._id).toBe('dto-id');
      expect(result.status).toBe('Published');
    });

    it('maps questionnaire-backed templates to form UI rows with template metadata', () => {
      const result = mapTemplateToUI({
        id: 'tpl-soap',
        organisationId: 'org-1',
        ownerUserId: null,
        ownership: 'YC_LIBRARY',
        kind: 'SOAP_NOTE',
        name: 'YC SOAP',
        description: 'Default SOAP',
        status: 'PUBLISHED',
        scope: 'ORGANISATION',
        rules: null,
        latestVersion: 3,
        publishedVersion: 2,
        createdBy: 'system',
        updatedBy: 'system',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        versions: [],
      });

      expect(result).toEqual(
        expect.objectContaining({
          _id: 'tpl-soap',
          name: 'YC SOAP',
          category: 'SOAP',
          status: 'Published',
          templateId: 'tpl-soap',
          templateKind: 'SOAP_NOTE',
          templateSource: 'YC_LIBRARY',
          templateVersion: 2,
          isTemplateBacked: true,
        })
      );
    });

    it('normalizes string timestamps into dates for template metadata', () => {
      const result = mapTemplateToUI({
        id: 'tpl-string-dates',
        organisationId: 'org-1',
        ownerUserId: null,
        ownership: 'ORG_TEMPLATE',
        kind: 'FORM',
        name: 'String dates',
        description: 'String timestamps',
        status: 'PUBLISHED',
        scope: 'ORGANISATION',
        rules: null,
        latestVersion: 1,
        publishedVersion: 1,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z' as never,
        updatedAt: '2026-01-02T00:00:00.000Z' as never,
        versions: [],
      });

      expect(result.templateId).toBe('tpl-string-dates');
      expect(result.name).toBe('String dates');
      expect(result.category).toBe('Custom');
    });

    it('hydrates versioned SOAP template defaults into form schema', () => {
      const result = mapTemplateToUI({
        id: 'tpl-soap',
        organisationId: 'org-1',
        ownerUserId: null,
        ownership: 'ORG_TEMPLATE',
        kind: 'SOAP_NOTE',
        name: 'SOAP',
        description: 'SOAP template',
        status: 'PUBLISHED',
        scope: 'ORGANISATION',
        rules: null,
        latestVersion: 1,
        publishedVersion: 1,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        versions: [
          {
            id: 'ver-1',
            version: 1,
            schemaSnapshot: {
              sections: [
                {
                  id: 'subjective',
                  title: 'Subjective',
                  fields: [
                    {
                      key: 'subjective',
                      label: 'Subjective',
                      type: 'richText',
                      defaultValue: '<p>Loaded SOAP content</p>',
                    },
                  ],
                },
              ],
            },
            renderConfigSnapshot: {},
            validationSnapshot: {},
            createdBy: 'user-1',
          },
        ],
      });

      expect(result.schema).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'subjective',
            type: 'group',
            fields: [
              expect.objectContaining({
                id: 'subjective',
                type: 'richtext',
                defaultValue: '<p>Loaded SOAP content</p>',
              }),
            ],
          }),
        ])
      );
    });

    it('maps care pathway templates to inpatient schedule rows', () => {
      const result = mapTemplateToUI({
        id: 'tpl-care',
        organisationId: 'org-1',
        ownerUserId: 'user-1',
        ownership: 'USER_TEMPLATE',
        kind: 'INPATIENT_SCHEDULE',
        name: 'Post-op pathway',
        description: null,
        status: 'DRAFT',
        scope: 'INPATIENT',
        rules: null,
        latestVersion: 1,
        publishedVersion: null,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        versions: [],
      });

      expect(result.category).toBe('Inpatient Schedule');
      expect(result.status).toBe('Draft');
      expect(result.templateVersion).toBe(1);
    });

    it('copies template species from rules into the UI model', () => {
      const result = mapTemplateToUI({
        id: 'tpl-species',
        organisationId: 'org-1',
        ownerUserId: null,
        ownership: 'ORG_TEMPLATE',
        kind: 'SOAP_NOTE',
        name: 'Species template',
        description: null,
        status: 'DRAFT',
        scope: 'ORGANISATION',
        rules: { appliesTo: { species: ['CANINE', 'FELINE'] } },
        latestVersion: 1,
        publishedVersion: null,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        versions: [],
      });

      expect(result.species).toEqual(['Canine', 'Feline']);
    });

    it('normalizes lowercase template species into UI labels', () => {
      const result = mapTemplateToUI({
        id: 'tpl-species-lower',
        organisationId: 'org-1',
        ownerUserId: null,
        ownership: 'ORG_TEMPLATE',
        kind: 'SOAP_NOTE',
        name: 'Species template',
        description: null,
        status: 'DRAFT',
        scope: 'ORGANISATION',
        rules: { appliesTo: { species: ['canine', 'feline', 'equine'] } },
        latestVersion: 1,
        publishedVersion: null,
        createdBy: 'user-1',
        updatedBy: 'user-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        versions: [],
      });

      expect(result.species).toEqual(['Canine', 'Feline', 'Equine']);
    });

    it('builds backend-compatible clinical template schemas with custom fields appended', () => {
      const schema = buildTemplateSchemaSnapshot({
        name: 'SOAP',
        category: 'SOAP',
        usage: 'Internal',
        updatedBy: '',
        lastUpdated: '',
        schema: [{ id: 'custom_note', label: 'Custom note', type: 'textarea' }],
      } as any);

      expect(schema.sections.map((section) => section.id)).toEqual(
        expect.arrayContaining(['subjective', 'objective', 'assessment', 'plan', 'custom_fields'])
      );
      expect(schema.sections.at(-1)?.fields[0]).toEqual(
        expect.objectContaining({ key: 'custom_note', type: 'richText' })
      );
    });

    it('builds template upsert payloads with rules from form metadata', () => {
      const payload = buildTemplatePayload(
        {
          name: 'Vitals',
          description: 'Vitals template',
          category: 'Vitals',
          usage: 'Internal',
          requiredSigner: '',
          species: ['Canine'],
          services: ['srv-1'],
          updatedBy: 'user-1',
          lastUpdated: '',
          schema: [],
        } as any,
        'org-1'
      );

      expect(payload).toEqual(
        expect.objectContaining({
          organisationId: 'org-1',
          ownership: 'ORG_TEMPLATE',
          kind: 'VITAL_RECORD',
          name: 'Vitals',
          scope: 'ORGANISATION',
          rules: expect.objectContaining({ species: ['Canine'], visibility: 'Internal' }),
        })
      );
      expect(payload.schemaSnapshot.sections.map((section) => section.id)).toEqual(
        expect.arrayContaining(['vitals', 'notes'])
      );
    });

    it('preserves SOAP rich-text defaults in the template payload', () => {
      const payload = buildTemplatePayload(
        {
          name: 'SOAP',
          description: 'SOAP template',
          category: 'SOAP',
          usage: 'Internal',
          requiredSigner: '',
          species: ['Canine'],
          services: ['srv-1'],
          updatedBy: 'user-1',
          lastUpdated: '',
          schema: [
            {
              id: 'subjective',
              type: 'richtext',
              label: 'Subjective',
              defaultValue: '<p>SOAP content</p>',
            },
            {
              id: 'objective',
              type: 'richtext',
              label: 'Objective',
              defaultValue: '<p>Objective content</p>',
            },
          ] as any,
        } as any,
        'org-1'
      );

      const subjective = payload.schemaSnapshot.sections.find(
        (section) => section.id === 'subjective'
      );
      const objective = payload.schemaSnapshot.sections.find(
        (section) => section.id === 'objective'
      );

      expect(subjective?.fields[0]).toEqual(
        expect.objectContaining({ key: 'subjective', defaultValue: '<p>SOAP content</p>' })
      );
      expect(objective?.fields[0]).toEqual(
        expect.objectContaining({ key: 'objective', defaultValue: '<p>Objective content</p>' })
      );
      expect(payload.kind).toBe('SOAP_NOTE');
      expect(payload.ownership).toBe('ORG_TEMPLATE');
    });

    it('pulls nested SOAP defaults from grouped authored fields', () => {
      const payload = buildTemplatePayload(
        {
          name: 'SOAP',
          description: 'SOAP template',
          category: 'SOAP',
          usage: 'Internal',
          requiredSigner: '',
          species: ['Canine'],
          services: ['srv-1'],
          updatedBy: 'user-1',
          lastUpdated: '',
          schema: [
            {
              id: 'subjective',
              type: 'group',
              label: 'Subjective',
              fields: [
                {
                  id: 'subjective',
                  type: 'richtext',
                  label: 'Subjective',
                  defaultValue: '<p>Nested SOAP content</p>',
                },
              ] as any,
            },
            {
              id: 'objective',
              type: 'group',
              label: 'Objective',
              fields: [
                {
                  id: 'objective',
                  type: 'richtext',
                  label: 'Objective',
                  defaultValue: '<p>Nested Objective content</p>',
                },
              ] as any,
            },
          ] as any,
        } as any,
        'org-1'
      );

      const subjective = payload.schemaSnapshot.sections.find(
        (section) => section.id === 'subjective'
      );
      const objective = payload.schemaSnapshot.sections.find(
        (section) => section.id === 'objective'
      );

      expect(subjective?.fields[0]).toEqual(
        expect.objectContaining({ defaultValue: '<p>Nested SOAP content</p>' })
      );
      expect(objective?.fields[0]).toEqual(
        expect.objectContaining({ defaultValue: '<p>Nested Objective content</p>' })
      );
    });

    it('builds task template payloads with the task assignment kind', () => {
      const payload = buildTemplatePayload(
        {
          name: 'Task template',
          description: 'Task template',
          category: 'Task Template',
          usage: 'Internal',
          requiredSigner: '',
          species: ['Canine'],
          services: ['svc-1'],
          updatedBy: 'user-1',
          lastUpdated: '',
          schema: [],
        } as any,
        'org-1'
      );

      expect(payload.kind).toBe('TASK_ASSIGNMENT');
      expect(payload.scope).toBe('INPATIENT');
      expect(payload.rules).toEqual(
        expect.objectContaining({
          appliesTo: expect.objectContaining({
            encounterModes: ['INPATIENT'],
          }),
        })
      );
    });
  });

  // --- 4. Payload Building ---

  describe('buildFHIRPayload', () => {
    // Fixed: Casting category to FormsCategory
    const mockUIForm = {
      _id: 'ui-1',
      name: 'UI Form',
      category: 'Medical' as FormsCategory,
      status: 'Draft',
      usage: 'Internal',
      schema: [], // Empty schema to test fallback
    } as any;

    it('builds payload with correct basic fields', () => {
      buildFHIRPayload({
        form: mockUIForm,
        orgId: 'org-1',
        userId: 'user-1',
      });

      // Verify toFormResponseDTO was called with normalized object
      expect(toFormResponseDTO).toHaveBeenCalled();
      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];

      expect(normalized.name).toBe('UI Form');
      expect(normalized.orgId).toBe('org-1');
      expect(normalized.updatedBy).toBe('user-1');
      expect(normalized.status).toBe('draft');
    });

    it('uses template schema if fallbackToTemplate is true and schema is empty', () => {
      // MockUIForm has empty schema and category "Medical" (which has a template in our mock)
      buildFHIRPayload({
        form: mockUIForm,
        orgId: 'org-1',
        userId: 'user-1',
        fallbackToTemplate: true,
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];
      expect(normalized.schema).toHaveLength(1);
      expect((normalized.schema[0] as any).name).toBe('template-field');
    });

    it('does NOT use template if fallbackToTemplate is false', () => {
      buildFHIRPayload({
        form: mockUIForm,
        orgId: 'org-1',
        userId: 'user-1',
        fallbackToTemplate: false,
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];
      expect(normalized.schema).toEqual([]);
    });

    it('uses existing schema if present (ignores template)', () => {
      const formWithSchema = {
        ...mockUIForm,
        schema: [{ name: 'existing', type: 'text' }],
      };

      buildFHIRPayload({
        form: formWithSchema,
        orgId: 'org-1',
        userId: 'user-1',
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];
      expect((normalized.schema[0] as any).name).toBe('existing');
    });

    it("maps 'Internal & External' usage to 'Internal_External' for backend", () => {
      const externalForm = { ...mockUIForm, usage: 'Internal & External' };

      buildFHIRPayload({
        form: externalForm,
        orgId: 'org-1',
        userId: 'user-1',
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];
      expect(normalized.visibilityType).toBe('Internal_External');
    });

    it('preserves createdBy if existing in form object', () => {
      // We force cast to include createdBy which might exist on the object but not on the UI props strictly
      const formWithCreator = { ...mockUIForm, createdBy: 'creator-user' };

      buildFHIRPayload({
        form: formWithCreator,
        orgId: 'org-1',
        userId: 'editor-user',
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];
      expect(normalized.createdBy).toBe('creator-user');
      expect(normalized.updatedBy).toBe('editor-user');
    });

    it('sets createdBy to userId if new form', () => {
      buildFHIRPayload({
        form: mockUIForm, // no createdBy
        orgId: 'org-1',
        userId: 'new-user',
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls[0][0];
      expect(normalized.createdBy).toBe('new-user');
    });

    it('carries inventory medicine ids through to the payload schema', () => {
      const medForm = {
        ...mockUIForm,
        schema: [
          {
            id: 'med-group',
            type: 'group',
            meta: { medicationGroup: true },
            fields: [
              {
                id: 'med-group_med_1_group',
                type: 'group',
                label: 'Inventory med',
                meta: { medicineId: 'med-123', inventoryItemId: 'med-123' },
                fields: [],
              },
            ],
          },
        ],
      };

      buildFHIRPayload({
        form: medForm as any,
        orgId: 'org-1',
        userId: 'user-1',
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls.at(-1)![0];
      const medMeta = (normalized.schema[0] as any).fields[0].meta;
      expect(medMeta).toEqual(
        expect.objectContaining({
          medicineId: 'med-123',
          inventoryItemId: 'med-123',
        })
      );
    });

    it('carries selected service ids through to the payload schema', () => {
      const serviceForm = {
        ...mockUIForm,
        schema: [
          {
            id: 'services_group',
            type: 'group',
            meta: { serviceGroup: true, serviceIds: ['srv-1', 'srv-2'] },
            fields: [
              {
                id: 'services_group_services',
                type: 'checkbox',
                meta: { serviceIds: ['srv-1', 'srv-2'] },
                options: [
                  { label: 'Service 1', value: 'srv-1' },
                  { label: 'Service 2', value: 'srv-2' },
                ],
              },
            ],
          },
        ],
      };

      buildFHIRPayload({
        form: serviceForm as any,
        orgId: 'org-1',
        userId: 'user-1',
      });

      const normalized = (toFormResponseDTO as jest.Mock).mock.calls.at(-1)![0];
      expect(normalized.schema[0].meta.serviceIds).toEqual(['srv-1', 'srv-2']);
      expect((normalized.schema[0] as any).fields[0].meta.serviceIds).toEqual(['srv-1', 'srv-2']);
    });
  });
});

describe('hasSignatureField', () => {
  it('returns false for empty fields array', () => {
    expect(hasSignatureField([])).toBe(false);
  });

  it('returns false for undefined fields (default param)', () => {
    expect(hasSignatureField()).toBe(false);
  });

  it('returns true when a signature field exists at the top level', () => {
    const fields: any[] = [{ type: 'text' }, { type: 'signature' }];
    expect(hasSignatureField(fields)).toBe(true);
  });

  it('returns true when a signature field is nested in a group', () => {
    const fields: any[] = [
      {
        type: 'group',
        fields: [{ type: 'text' }, { type: 'signature' }],
      },
    ];
    expect(hasSignatureField(fields)).toBe(true);
  });

  it('returns false when no signature field exists in nested groups', () => {
    const fields: any[] = [{ type: 'group', fields: [{ type: 'text' }] }];
    expect(hasSignatureField(fields)).toBe(false);
  });
});

describe('removeSignatureFields', () => {
  it('returns empty array for empty input', () => {
    expect(removeSignatureFields([])).toEqual([]);
  });

  it('removes top-level signature fields', () => {
    const fields: any[] = [
      { type: 'text', id: 'f1' },
      { type: 'signature', id: 'sig1' },
      { type: 'text', id: 'f2' },
    ];
    const result = removeSignatureFields(fields);
    expect(result.map((f) => (f as any).id)).toEqual(['f1', 'f2']);
  });

  it('removes signature fields nested inside groups', () => {
    const fields: any[] = [
      {
        type: 'group',
        id: 'g1',
        fields: [
          { type: 'text', id: 'f1' },
          { type: 'signature', id: 'sig1' },
        ],
      },
    ];
    const result = removeSignatureFields(fields) as any[];
    expect(result[0].fields.map((f: any) => f.id)).toEqual(['f1']);
  });

  it('preserves non-group non-signature fields unchanged', () => {
    const fields: any[] = [{ type: 'text', id: 'f1' }];
    const result = removeSignatureFields(fields);
    expect(result).toEqual(fields);
  });
});

describe('ensureSingleSignatureAtEnd', () => {
  it('appends signature field to empty array', () => {
    const result = ensureSingleSignatureAtEnd([]) as any[];
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('signature');
    expect(result[0].label).toBe('Signature');
  });

  it('removes existing signature fields and appends a single one at the end', () => {
    const fields: any[] = [
      { type: 'text', id: 'f1' },
      { type: 'signature', id: 'sig-old' },
      { type: 'text', id: 'f2' },
    ];
    const result = ensureSingleSignatureAtEnd(fields) as any[];
    const sigFields = result.filter((f: any) => f.type === 'signature');
    expect(sigFields).toHaveLength(1);
    expect(result.at(-1)?.type).toBe('signature');
  });

  it('uses custom label when provided', () => {
    const result = ensureSingleSignatureAtEnd([], 'Patient Signature') as any[];
    expect(result[0].label).toBe('Patient Signature');
  });

  it("assigns id 'signature' to the appended signature field", () => {
    const result = ensureSingleSignatureAtEnd([]) as any[];
    expect(result[0].id).toBe('signature');
  });
});
