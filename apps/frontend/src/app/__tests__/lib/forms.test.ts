import {
  statusToLabel,
  labelToStatus,
  hasSignatureField,
  removeSignatureFields,
  ensureSingleSignatureAtEnd,
  buildTemplateSchemaSnapshot,
  buildTemplatePayload,
  mapFormToUI,
  mapTemplateToUI,
  buildFHIRPayload,
  mapQuestionnaireToUI,
  questionnaireToForm,
  shouldUseTemplateApi,
  formatDateLabel,
  formatTimeLabel,
  templateStatusToLabel,
  templateKindToCategory,
  categoryToTemplateKind,
  getCategoryTemplate,
} from '@/app/lib/forms';
import type { FormField, FormsProps } from '@/app/features/forms/types/forms';

// We only test pure logic functions that don't depend on timezone/date formatting

describe('statusToLabel', () => {
  it('maps "draft" to "Draft"', () => {
    expect(statusToLabel('draft')).toBe('Draft');
  });

  it('maps "published" to "Published"', () => {
    expect(statusToLabel('published')).toBe('Published');
  });

  it('maps "archived" to "Archived"', () => {
    expect(statusToLabel('archived')).toBe('Archived');
  });

  it('defaults to "Draft" for undefined', () => {
    expect(statusToLabel(undefined)).toBe('Draft');
  });
});

describe('labelToStatus', () => {
  it('maps "Draft" to "draft"', () => {
    expect(labelToStatus('Draft')).toBe('draft');
  });

  it('maps "Published" to "published"', () => {
    expect(labelToStatus('Published')).toBe('published');
  });

  it('maps "Archived" to "archived"', () => {
    expect(labelToStatus('Archived')).toBe('archived');
  });

  it('defaults to "draft" for undefined', () => {
    expect(labelToStatus(undefined)).toBe('draft');
  });
});

describe('hasSignatureField', () => {
  it('returns false for empty array', () => {
    expect(hasSignatureField([])).toBe(false);
  });

  it('returns false when no signature fields', () => {
    const fields = [{ id: '1', type: 'text', label: 'Name' }] as unknown as FormField[];
    expect(hasSignatureField(fields)).toBe(false);
  });

  it('returns true when a top-level signature field exists', () => {
    const fields = [{ id: 'sig', type: 'signature', label: 'Signature' }] as unknown as FormField[];
    expect(hasSignatureField(fields)).toBe(true);
  });

  it('returns true when a nested group contains a signature field', () => {
    const fields = [
      {
        id: 'grp',
        type: 'group',
        label: 'Group',
        fields: [{ id: 'sig', type: 'signature', label: 'Sign' }],
      },
    ] as unknown as FormField[];
    expect(hasSignatureField(fields)).toBe(true);
  });

  it('returns false for nested group with no signature', () => {
    const fields = [
      {
        id: 'grp',
        type: 'group',
        label: 'Group',
        fields: [{ id: 'txt', type: 'text', label: 'Text' }],
      },
    ] as unknown as FormField[];
    expect(hasSignatureField(fields)).toBe(false);
  });
});

describe('removeSignatureFields', () => {
  it('returns empty array for empty input', () => {
    expect(removeSignatureFields([])).toEqual([]);
  });

  it('removes top-level signature fields', () => {
    const fields = [
      { id: '1', type: 'text', label: 'Name' },
      { id: '2', type: 'signature', label: 'Sig' },
    ] as unknown as FormField[];
    const result = removeSignatureFields(fields);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('removes nested signature fields from groups', () => {
    const fields = [
      {
        id: 'grp',
        type: 'group',
        label: 'Group',
        fields: [
          { id: 'txt', type: 'text', label: 'Text' },
          { id: 'sig', type: 'signature', label: 'Sign' },
        ],
      },
    ] as unknown as FormField[];
    const result = removeSignatureFields(fields);
    expect(result).toHaveLength(1);
    expect((result[0] as any).fields).toHaveLength(1);
    expect((result[0] as any).fields[0].type).toBe('text');
  });

  it('keeps non-signature, non-group fields unchanged', () => {
    const fields = [
      { id: '1', type: 'text', label: 'Name' },
      { id: '2', type: 'checkbox', label: 'Agree' },
    ] as unknown as FormField[];
    expect(removeSignatureFields(fields)).toHaveLength(2);
  });
});

describe('ensureSingleSignatureAtEnd', () => {
  it('appends a signature field to the end', () => {
    const fields = [{ id: '1', type: 'text', label: 'Name' }] as unknown as FormField[];
    const result = ensureSingleSignatureAtEnd(fields);
    expect(result).toHaveLength(2);
    expect(result[result.length - 1].type).toBe('signature');
  });

  it('removes existing signatures and adds one at end', () => {
    const fields = [
      { id: 'sig1', type: 'signature', label: 'Old Sig' },
      { id: '1', type: 'text', label: 'Name' },
    ] as unknown as FormField[];
    const result = ensureSingleSignatureAtEnd(fields);
    const signatures = result.filter((f) => f.type === 'signature');
    expect(signatures).toHaveLength(1);
    expect(result[result.length - 1].type).toBe('signature');
  });

  it('uses custom label for the signature field', () => {
    const fields = [{ id: '1', type: 'text', label: 'Name' }] as unknown as FormField[];
    const result = ensureSingleSignatureAtEnd(fields, 'Owner Signature');
    expect(result[result.length - 1].label).toBe('Owner Signature');
  });

  it('works with empty array', () => {
    const result = ensureSingleSignatureAtEnd([]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('signature');
  });
});

describe('buildTemplateSchemaSnapshot rich-text round-trip', () => {
  const baseForm = (schema: FormField[]): FormsProps => ({
    name: 'Notes form',
    category: 'Custom',
    usage: 'Internal',
    updatedBy: 'user-1',
    lastUpdated: '',
    schema,
  });

  it('emits the rich-text type and carries the default HTML as defaultValue', () => {
    const schema = [
      {
        id: 'clinicalNotes',
        type: 'richtext',
        label: 'Clinical notes',
        defaultValue: '<p>Seen and treated</p>',
      },
    ] as unknown as FormField[];

    const snapshot = buildTemplateSchemaSnapshot(baseForm(schema), 'FORM');
    const field = snapshot.sections[0].fields[0];

    expect(field.type).toBe('richText');
    expect(field.defaultValue).toBe('<p>Seen and treated</p>');
  });

  it('omits defaultValue for non rich-text fields', () => {
    const schema = [
      {
        id: 'name',
        type: 'input',
        label: 'Name',
        defaultValue: 'should be ignored',
      },
    ] as unknown as FormField[];

    const snapshot = buildTemplateSchemaSnapshot(baseForm(schema), 'FORM');
    const field = snapshot.sections[0].fields[0];

    expect(field.type).toBe('text');
    expect(field.defaultValue).toBeUndefined();
  });
});

describe('buildTemplateSchemaSnapshot canonical blueprint merge', () => {
  it('does not duplicate canonical SOAP fields into custom_fields', () => {
    const snapshot = buildTemplateSchemaSnapshot(
      {
        name: 'SOAP',
        category: 'SOAP',
        usage: 'Internal',
        updatedBy: 'user-1',
        lastUpdated: '',
        schema: [
          { id: 'subjective', type: 'richtext', label: 'Subjective', defaultValue: '<p>s</p>' },
          { id: 'objective', type: 'richtext', label: 'Objective', defaultValue: '<p>o</p>' },
          { id: 'assessment', type: 'richtext', label: 'Assessment', defaultValue: '<p>a</p>' },
          { id: 'plan', type: 'richtext', label: 'Plan', defaultValue: '<p>p</p>' },
        ] as unknown as FormField[],
      },
      'SOAP_NOTE'
    );

    expect(snapshot.sections.map((section) => section.id)).toEqual([
      'subjective',
      'objective',
      'assessment',
      'plan',
    ]);
    expect(snapshot.sections[0].fields[0].defaultValue).toBe('<p>s</p>');
    expect(snapshot.sections[1].fields[0].defaultValue).toBe('<p>o</p>');
  });

  it('keeps extra SOAP fields in custom_fields', () => {
    const snapshot = buildTemplateSchemaSnapshot(
      {
        name: 'SOAP',
        category: 'SOAP',
        usage: 'Internal',
        updatedBy: 'user-1',
        lastUpdated: '',
        schema: [
          { id: 'subjective', type: 'richtext', label: 'Subjective' },
          {
            id: 'clinical_note',
            type: 'richtext',
            label: 'Clinical note',
            defaultValue: '<p>x</p>',
          },
        ] as unknown as FormField[],
      },
      'SOAP_NOTE'
    );

    expect(snapshot.sections.map((section) => section.id)).toEqual([
      'subjective',
      'objective',
      'assessment',
      'plan',
      'custom_fields',
    ]);
    expect(snapshot.sections.at(-1)?.fields.map((field) => field.key)).toEqual(['clinical_note']);
  });

  it('merges authored discharge defaults into the canonical sections', () => {
    const snapshot = buildTemplateSchemaSnapshot(
      {
        name: 'Discharge',
        category: 'Discharge Form',
        usage: 'Internal',
        updatedBy: 'user-1',
        lastUpdated: '',
        schema: [
          {
            id: 'summaryText',
            type: 'richtext',
            label: 'Discharge summary',
            defaultValue: '<p>ok</p>',
          },
          { id: 'followUpInDays', type: 'number', label: 'Follow up in (days)', defaultValue: 7 },
        ] as unknown as FormField[],
      },
      'DISCHARGE_SUMMARY'
    );

    expect(snapshot.sections.map((section) => section.id)).toEqual(['summary', 'follow_up']);
    expect(snapshot.sections[0].fields[0].defaultValue).toBe('<p>ok</p>');
    expect(snapshot.sections[1].fields[0].defaultValue).toBe(7);
  });

  it('does not duplicate canonical discharge fields into custom_fields', () => {
    const snapshot = buildTemplateSchemaSnapshot(
      {
        name: 'Discharge',
        category: 'Discharge Form',
        usage: 'Internal',
        updatedBy: 'user-1',
        lastUpdated: '',
        schema: [
          {
            id: 'summary_section',
            type: 'group',
            label: 'Discharge summary',
            fields: [
              {
                id: 'summaryText',
                type: 'richtext',
                label: 'Discharge summary',
                defaultValue: '<p>ok</p>',
              },
            ] as unknown as FormField[],
          },
          {
            id: 'follow_up_section',
            type: 'group',
            label: 'Follow up',
            fields: [
              {
                id: 'followUpInDays',
                type: 'number',
                label: 'Follow up in (days)',
                defaultValue: 7,
              },
            ] as unknown as FormField[],
          },
        ] as unknown as FormField[],
      },
      'DISCHARGE_SUMMARY'
    );

    expect(snapshot.sections.map((section) => section.id)).toEqual(['summary', 'follow_up']);
    expect(snapshot.sections.at(-1)?.fields.map((field) => field.key)).toEqual(['followUpInDays']);
  });

  it('keeps task schedule defaults on the canonical taskBlocks field', () => {
    const snapshot = buildTemplateSchemaSnapshot(
      {
        name: 'Task',
        category: 'Task Template',
        usage: 'Internal',
        updatedBy: 'user-1',
        lastUpdated: '',
        schema: [
          {
            id: 'task_blocks',
            type: 'group',
            label: 'Schedule tasks',
            meta: { taskGroup: true },
            fields: [
              {
                id: 'task-1',
                type: 'group',
                label: 'Vitals',
                meta: { taskBlock: true },
                fields: [
                  { id: 'task-1_name', type: 'input', label: 'Task name', defaultValue: 'Vitals' },
                  {
                    id: 'task-1_category',
                    type: 'dropdown',
                    label: 'Category',
                    defaultValue: 'CARE',
                  },
                ] as unknown as FormField[],
              },
            ] as unknown as FormField[],
          },
        ] as unknown as FormField[],
      },
      'INPATIENT_SCHEDULE'
    );

    const scheduleSection = snapshot.sections.find((section) => section.id === 'schedule');
    const taskBlocks = scheduleSection?.fields.find((field) => field.key === 'taskBlocks');
    expect(taskBlocks?.defaultValue).toEqual([
      expect.objectContaining({ name: 'Vitals', category: 'CARE' }),
    ]);
  });

  it('serializes YC-default Task Template (TASK_ASSIGNMENT) task blocks into schedule.taskBlocks', () => {
    // No explicit kind override: category 'Task Template' must resolve to
    // TASK_ASSIGNMENT and still serialize its authored task blocks.
    const snapshot = buildTemplateSchemaSnapshot({
      name: 'Care pathway',
      category: 'Task Template',
      usage: 'Internal',
      updatedBy: 'user-1',
      lastUpdated: '',
      schema: [
        {
          id: 'task_blocks',
          type: 'group',
          label: 'Schedule tasks',
          meta: { taskGroup: true },
          fields: [
            {
              id: 'task-1',
              type: 'group',
              label: 'Record vitals',
              meta: { taskBlock: true },
              fields: [
                {
                  id: 'task-1_name',
                  type: 'input',
                  label: 'Task title',
                  defaultValue: 'Record vitals',
                },
                {
                  id: 'task-1_category',
                  type: 'dropdown',
                  label: 'Category',
                  defaultValue: 'CARE',
                  meta: { taskBlockKey: 'category' },
                },
                {
                  id: 'task-1_recurrence',
                  type: 'dropdown',
                  label: 'Repeat',
                  defaultValue: 'EVERY_6_HOURS',
                  meta: { taskBlockKey: 'recurrence.type' },
                },
                {
                  id: 'task-1_reminderOffsetMinutes',
                  type: 'dropdown',
                  label: 'Reminder',
                  defaultValue: '5',
                  meta: { taskBlockKey: 'reminderOffsetMinutes' },
                },
                {
                  id: 'task-1_durationDays',
                  type: 'number',
                  label: 'Duration',
                  defaultValue: '3',
                  meta: { taskBlockKey: 'durationDays' },
                },
              ] as unknown as FormField[],
            },
          ] as unknown as FormField[],
        },
      ] as unknown as FormField[],
    });

    const scheduleSection = snapshot.sections.find((section) => section.id === 'schedule');
    const taskBlocks = scheduleSection?.fields.find((field) => field.key === 'taskBlocks');
    expect(taskBlocks?.defaultValue).toEqual([
      expect.objectContaining({
        name: 'Record vitals',
        category: 'CARE',
        taskKind: 'CUSTOM',
        reminderOffsetMinutes: 5,
        durationDays: 3,
        // EVERY_6_HOURS resolves to a CUSTOM recurrence with a cron.
        recurrence: { type: 'CUSTOM', cronExpression: '0 */6 * * *' },
      }),
    ]);
  });
});

describe('mapTemplateToUI', () => {
  it('maps library and canonical template sources to user-friendly values', () => {
    const template = {
      id: 'template-1',
      kind: 'SOAP_NOTE',
      source: 'USER',
      ownership: undefined,
      status: 'draft',
      publishedVersion: 1,
      latestVersion: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user-1',
      updatedBy: 'user-2',
      organisationId: 'org-1',
      rules: {},
    } as any;

    const ui = mapTemplateToUI(template);

    expect(ui.templateSource).toBe('USER_TEMPLATE');
    expect(ui.templateKind).toBe('SOAP_NOTE');
  });

  it('normalizes reloaded task-assignment templates back into task-block builder schema', () => {
    const template = {
      id: 'template-task-1',
      kind: 'TASK_ASSIGNMENT',
      source: 'ORGANISATION',
      ownership: 'ORG_TEMPLATE',
      status: 'DRAFT',
      latestVersion: 1,
      publishedVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user-1',
      updatedBy: 'user-2',
      organisationId: 'org-1',
      rules: {},
      versions: [
        {
          version: 1,
          schemaSnapshot: {
            sections: [
              {
                id: 'schedule',
                title: 'Schedule',
                fields: [
                  {
                    key: 'taskBlocks',
                    label: 'Task blocks',
                    type: 'repeater',
                    defaultValue: [
                      {
                        name: 'Care check',
                        category: 'CARE',
                        additionalNotes: 'Watch appetite and hydration',
                        durationDays: 3,
                        reminderOffsetMinutes: 5,
                        recurrence: { type: 'CUSTOM', cronExpression: '0 */6 * * *' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    } as any;

    const ui = mapTemplateToUI(template);
    const taskGroup = ui.schema[0] as FormField & { fields?: FormField[] };
    const taskBlock = taskGroup.fields?.[0] as FormField & { fields?: FormField[] };

    expect(ui.category).toBe('Task Template');
    expect(taskGroup.id).toBe('task_blocks');
    expect(taskGroup.meta?.taskGroup).toBe(true);
    expect(taskBlock.fields?.map((field) => field.meta?.taskBlockKey)).toEqual([
      'name',
      'category',
      'additionalNotes',
      'recurrence.type',
      'reminderOffsetMinutes',
      'durationDays',
    ]);
    expect(
      taskBlock.fields?.find((field) => field.meta?.taskBlockKey === 'name')?.defaultValue
    ).toBe('Care check');
    expect(
      taskBlock.fields?.find((field) => field.meta?.taskBlockKey === 'recurrence.type')
        ?.defaultValue
    ).toBe('EVERY_6_HOURS');
    expect(
      taskBlock.fields?.find((field) => field.meta?.taskBlockKey === 'reminderOffsetMinutes')
        ?.defaultValue
    ).toBe('5');
    expect(
      taskBlock.fields?.find((field) => field.meta?.taskBlockKey === 'durationDays')?.defaultValue
    ).toBe('3');
    expect(
      taskBlock.fields?.find((field) => field.meta?.taskBlockKey === 'additionalNotes')
        ?.defaultValue
    ).toBe('Watch appetite and hydration');
  });
});

describe('buildTemplatePayload appliesTo linking', () => {
  const form = (overrides: Partial<FormsProps>): FormsProps => ({
    name: 'Tpl',
    category: 'SOAP',
    usage: 'Internal',
    updatedBy: 'u1',
    lastUpdated: '',
    schema: [],
    species: ['Canine'],
    services: ['svc-1', 'pkg-1'],
    ...overrides,
  });

  it('writes the selected catalog ids and species into rules.appliesTo', () => {
    const payload = buildTemplatePayload(form({ category: 'SOAP' }), 'org-1');
    const appliesTo = (payload.rules as { appliesTo?: Record<string, unknown> }).appliesTo;
    expect(appliesTo?.serviceIds).toEqual(['svc-1', 'pkg-1']);
    expect(appliesTo?.packageIds).toEqual(['svc-1', 'pkg-1']);
    expect(appliesTo?.species).toEqual(['Canine']);
    expect(appliesTo?.encounterModes).toBeUndefined();
  });

  it('constrains task templates to the inpatient encounter mode and scope', () => {
    const payload = buildTemplatePayload(form({ category: 'Task Template' }), 'org-1');
    const appliesTo = (payload.rules as { appliesTo?: Record<string, unknown> }).appliesTo;
    expect(appliesTo?.encounterModes).toEqual(['INPATIENT']);
    expect(payload.scope).toBe('INPATIENT');
    expect(payload.kind).toBe('TASK_ASSIGNMENT');
  });

  it('serializes YC default templates as library-owned without an organisation binding', () => {
    const payload = buildTemplatePayload(
      form({
        category: 'Prescription',
        templateSource: 'YC_LIBRARY',
        requiredSigner: '',
      }),
      'org-1'
    );

    expect(payload.ownership).toBe('YC_LIBRARY');
    expect(payload.organisationId).toBeUndefined();
    expect(payload.kind).toBe('PRESCRIPTION');
    expect((payload.rules as { requiredSigner?: string }).requiredSigner).toBe('');
  });

  it('serializes every prescription medication default into medicationLine rows', () => {
    const payload = buildTemplatePayload(
      form({
        category: 'Prescription',
        schema: [
          {
            id: 'medications',
            type: 'group',
            label: 'Medications',
            meta: { medicationGroup: true },
            fields: [
              {
                id: 'inv-1_group',
                type: 'group',
                label: 'Carprofen',
                meta: {
                  medicineId: 'inv-1',
                  inventoryItemId: 'inv-1',
                  medicineName: 'Carprofen',
                },
                fields: [
                  {
                    id: 'inv-1_name',
                    type: 'input',
                    label: 'Name',
                    defaultValue: 'Carprofen',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'medicineName' },
                  },
                  {
                    id: 'inv-1_brand',
                    type: 'input',
                    label: 'Brand',
                    defaultValue: 'Rimadyl',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'brand' },
                  },
                  {
                    id: 'inv-1_genericName',
                    type: 'input',
                    label: 'Generic name',
                    defaultValue: 'Carprofen',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'genericName' },
                  },
                  {
                    id: 'inv-1_sku',
                    type: 'input',
                    label: 'SKU',
                    defaultValue: 'SKU-CARP',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'sku' },
                  },
                  {
                    id: 'inv-1_strength',
                    type: 'input',
                    label: 'Strength',
                    defaultValue: '25',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'strength' },
                  },
                  {
                    id: 'inv-1_strengthUnit',
                    type: 'input',
                    label: 'Strength unit',
                    defaultValue: 'mg',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'strengthUnit' },
                  },
                  {
                    id: 'inv-1_form',
                    type: 'input',
                    label: 'Form',
                    defaultValue: 'Tablet',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'dosageForm' },
                  },
                  {
                    id: 'inv-1_route',
                    type: 'input',
                    label: 'Route',
                    defaultValue: 'Oral',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'route' },
                  },
                  {
                    id: 'inv-1_frequency',
                    type: 'input',
                    label: 'Frequency',
                    defaultValue: 'BID (twice daily)',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'frequency' },
                  },
                  {
                    id: 'inv-1_duration',
                    type: 'input',
                    label: 'Duration',
                    defaultValue: '7',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'durationDays' },
                  },
                  {
                    id: 'inv-1_durationUnit',
                    type: 'input',
                    label: 'Duration unit',
                    defaultValue: 'days',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'durationUnit' },
                  },
                  {
                    id: 'inv-1_qty',
                    type: 'number',
                    label: 'Quantity',
                    defaultValue: '14',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'qty' },
                  },
                  {
                    id: 'inv-1_refill',
                    type: 'number',
                    label: 'Refills',
                    defaultValue: '1',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'refill' },
                  },
                  {
                    id: 'inv-1_remark',
                    type: 'textarea',
                    label: 'Instructions',
                    defaultValue: 'Give with food',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'instructions' },
                  },
                  {
                    id: 'inv-1_fulfillment',
                    type: 'input',
                    label: 'Fulfillment',
                    defaultValue: 'IN_HOUSE',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'fulfillment' },
                  },
                  {
                    id: 'inv-1_priceCents',
                    type: 'number',
                    label: 'Price (cents)',
                    defaultValue: 1800,
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'priceCents' },
                  },
                  {
                    id: 'inv-1_controlledSubstance',
                    type: 'input',
                    label: 'Controlled substance',
                    defaultValue: 'false',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'controlledSubstance' },
                  },
                  {
                    id: 'inv-1_prescriptionRequired',
                    type: 'input',
                    label: 'Prescription required',
                    defaultValue: 'true',
                    meta: { inventoryItemId: 'inv-1', prescriptionField: 'prescriptionRequired' },
                  },
                ],
              },
            ],
          },
        ] as unknown as FormField[],
      }),
      'org-1'
    );

    const medicationLine = payload.schemaSnapshot.sections[0].fields[0] as {
      defaultValue?: Array<Record<string, unknown>>;
    };
    expect(medicationLine.defaultValue?.[0]).toMatchObject({
      inventoryItemId: 'inv-1',
      medicineId: 'inv-1',
      medicineName: 'Carprofen',
      brand: 'Rimadyl',
      genericName: 'Carprofen',
      sku: 'SKU-CARP',
      strength: '25',
      strengthUnit: 'mg',
      dosageForm: 'Tablet',
      route: 'Oral',
      frequency: 'BID (twice daily)',
      durationDays: '7',
      durationUnit: 'days',
      qty: '14',
      refill: '1',
      instructions: 'Give with food',
      fulfillment: 'IN_HOUSE',
      priceCents: 1800,
      controlledSubstance: 'false',
      prescriptionRequired: 'true',
    });
  });

  it('keeps the canonical prescription instructions and notes sections when mapping to UI', () => {
    const mapped = mapTemplateToUI({
      id: 'tpl-prescription',
      organisationId: 'org-1',
      ownerUserId: null,
      ownership: 'YC_LIBRARY',
      kind: 'PRESCRIPTION',
      name: 'Prescription',
      description: null,
      status: 'DRAFT',
      scope: 'ORGANISATION',
      rules: {},
      latestVersion: 1,
      publishedVersion: null,
      createdBy: 'u1',
      updatedBy: 'u1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      versions: [
        {
          id: 'ver-1',
          version: 1,
          templateId: 'tpl-prescription',
          schemaSnapshot: {
            sections: [
              {
                id: 'medications',
                title: 'Medications',
                fields: [
                  {
                    key: 'medicationLine',
                    label: 'Medication lines',
                    type: 'medicationLine',
                    repeatable: true,
                  },
                ],
              },
              { id: 'instructions', title: 'Instructions', fields: [] },
              { id: 'notes', title: 'Notes', fields: [] },
            ],
          },
          renderConfigSnapshot: null,
          validationSnapshot: null,
          createdBy: 'u1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    } as any);

    expect(mapped.schema.map((section) => section.id)).toEqual([
      'medications',
      'instructions',
      'notes',
    ]);
  });

  it('keeps the populated richText instructions and notes sections the backend returns on reload', () => {
    const mapped = mapTemplateToUI({
      id: 'tpl-prescription-rich',
      organisationId: 'org-1',
      ownerUserId: null,
      ownership: 'YC_LIBRARY',
      kind: 'PRESCRIPTION',
      name: 'Prescription skin',
      description: null,
      status: 'DRAFT',
      scope: 'ORGANISATION',
      rules: {},
      latestVersion: 1,
      publishedVersion: null,
      createdBy: 'u1',
      updatedBy: 'u1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      versions: [
        {
          id: 'ver-1',
          version: 1,
          templateId: 'tpl-prescription-rich',
          schemaSnapshot: {
            sections: [
              {
                id: 'medications',
                title: 'Medications',
                order: 1,
                fields: [
                  {
                    key: 'medicationLine',
                    label: 'Medication lines',
                    type: 'medicationLine',
                    repeatable: true,
                  },
                ],
              },
              {
                id: 'instructions',
                title: 'Instructions',
                order: 2,
                fields: [
                  { key: 'instructions', label: 'Instructions', type: 'richText', order: 1 },
                ],
              },
              {
                id: 'notes',
                title: 'Notes',
                order: 3,
                fields: [{ key: 'notes', label: 'Notes', type: 'richText', order: 1 }],
              },
            ],
          },
          renderConfigSnapshot: null,
          validationSnapshot: null,
          createdBy: 'u1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    } as any);

    expect(mapped.schema.map((section) => section.id)).toEqual([
      'medications',
      'instructions',
      'notes',
    ]);
  });
});

describe('species label normalization', () => {
  it('maps legacy generic form species to biological labels', () => {
    const mapped = mapFormToUI({
      _id: 'form-1',
      orgId: 'org-1',
      name: 'Consent',
      description: 'Consent form',
      category: 'Consent form',
      speciesFilter: ['Dog', 'cat', 'HORSE'],
      status: 'draft',
      schema: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as any);

    expect(mapped.species).toEqual(['Canine', 'Feline', 'Equine']);
  });

  it('maps template rule species codes to biological labels', () => {
    const mapped = mapTemplateToUI({
      id: 'tpl-species',
      organisationId: 'org-1',
      ownerUserId: null,
      ownership: 'ORG_TEMPLATE',
      kind: 'SOAP_NOTE',
      name: 'SOAP',
      description: null,
      status: 'DRAFT',
      scope: 'ORGANISATION',
      rules: {
        appliesTo: {
          species: ['DOG', 'FELINE', 'horse'],
        },
      },
      latestVersion: 1,
      publishedVersion: null,
      createdBy: 'u1',
      updatedBy: 'u1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as any);

    expect(mapped.species).toEqual(['Canine', 'Feline', 'Equine']);
  });
});

describe('mapTemplateToUI ownership fallback', () => {
  it('derives YC default ownership from source when ownership is missing', () => {
    const mapped = mapTemplateToUI({
      id: 'tpl-1',
      organisationId: 'org-1',
      ownerUserId: null,
      kind: 'SOAP_NOTE',
      name: 'SOAP',
      description: null,
      status: 'DRAFT',
      scope: 'ORGANISATION',
      rules: {},
      latestVersion: 1,
      publishedVersion: null,
      createdBy: 'u1',
      updatedBy: 'u1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      source: 'YC_LIBRARY',
    } as any);

    expect(mapped.templateSource).toBe('YC_LIBRARY');
  });

  it('maps organisation source to org template ownership when ownership is missing', () => {
    const mapped = mapTemplateToUI({
      id: 'tpl-2',
      organisationId: 'org-1',
      ownerUserId: null,
      kind: 'SOAP_NOTE',
      name: 'SOAP',
      description: null,
      status: 'DRAFT',
      scope: 'ORGANISATION',
      rules: {},
      latestVersion: 1,
      publishedVersion: null,
      createdBy: 'u1',
      updatedBy: 'u1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      source: 'ORGANISATION',
    } as any);

    expect(mapped.templateSource).toBe('ORG_TEMPLATE');
  });

  it('falls back to appliesTo service and package ids when catalog links are missing', () => {
    const mapped = mapTemplateToUI({
      id: 'tpl-3',
      organisationId: 'org-1',
      ownerUserId: null,
      ownership: 'ORG_TEMPLATE',
      kind: 'SOAP_NOTE',
      name: 'SOAP',
      description: null,
      status: 'DRAFT',
      scope: 'ORGANISATION',
      rules: {
        appliesTo: {
          serviceIds: ['svc-1'],
          packageIds: ['pkg-1'],
        },
      },
      latestVersion: 1,
      publishedVersion: null,
      createdBy: 'u1',
      updatedBy: 'u1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as any);

    expect(mapped.services).toEqual(['svc-1', 'pkg-1']);
  });
});

describe('label helpers and category maps', () => {
  it('formats date and time labels without throwing on undefined', () => {
    expect(typeof formatDateLabel(new Date('2026-01-05T10:30:00.000Z'))).toBe('string');
    expect(formatDateLabel(undefined)).toBe('');
    expect(typeof formatTimeLabel(new Date('2026-01-05T10:30:00.000Z'))).toBe('string');
    expect(formatTimeLabel(undefined)).toBe('');
  });

  it('falls back to Draft/draft for unknown status values', () => {
    expect(statusToLabel('bogus' as never)).toBe('Draft');
    expect(labelToStatus('Bogus' as never)).toBe('draft');
    expect(templateStatusToLabel(undefined)).toBe('Draft');
    expect(templateStatusToLabel('PUBLISHED')).toBe('Published');
    expect(templateStatusToLabel('BOGUS' as never)).toBe('Draft');
  });

  it('maps template kinds and categories in both directions', () => {
    expect(templateKindToCategory(undefined)).toBe('Custom');
    expect(templateKindToCategory('VITAL_RECORD')).toBe('Vitals');
    expect(templateKindToCategory('BOGUS' as never)).toBe('Custom');
    expect(categoryToTemplateKind('Vitals')).toBe('VITAL_RECORD');
    expect(categoryToTemplateKind('Inpatient Schedule')).toBe('INPATIENT_SCHEDULE');
    expect(categoryToTemplateKind('Consent form')).toBe('CONSENT');
    expect(categoryToTemplateKind('Prescription Template' as never)).toBe('PRESCRIPTION');
    expect(categoryToTemplateKind('Unknown' as never)).toBeNull();
  });

  it('returns an empty template for unknown categories', () => {
    expect(getCategoryTemplate('Unknown' as never)).toEqual([]);
  });

  it('decides template-API usage from category or explicit backing', () => {
    expect(shouldUseTemplateApi({ category: 'SOAP' as never, isTemplateBacked: false })).toBe(true);
    expect(shouldUseTemplateApi({ category: 'Unknown' as never, isTemplateBacked: true })).toBe(
      true
    );
    expect(shouldUseTemplateApi({ category: 'Unknown' as never, isTemplateBacked: false })).toBe(
      false
    );
  });
});

describe('buildFHIRPayload and questionnaire round-trip', () => {
  const roundTripForm: FormsProps = {
    name: 'Round trip',
    description: 'RT form',
    category: 'Custom',
    usage: 'Internal & External',
    requiredSigner: '',
    updatedBy: 'user-1',
    lastUpdated: '',
    schema: [{ id: 'q1', type: 'input', label: 'Question 1' }] as unknown as FormField[],
    services: ['svc-1'],
    species: ['Canine'],
    status: 'Published',
  };

  it('serializes a form to a DTO and maps it back to UI shape', () => {
    const dto = buildFHIRPayload({ form: roundTripForm, orgId: 'org-1', userId: 'user-9' });
    expect(dto).toBeTruthy();

    const form = questionnaireToForm(dto as never);
    expect(form.name).toBe('Round trip');

    const ui = mapQuestionnaireToUI(dto as never);
    expect(ui.name).toBe('Round trip');
    expect(ui.status).toBe('Published');
    expect(ui.schema.map((f) => f.id)).toEqual(['q1']);
  });

  it('falls back to the category template when the form has no schema', () => {
    const dto = buildFHIRPayload({
      form: { ...roundTripForm, schema: [], category: 'Consent form', usage: undefined as never },
      orgId: 'org-1',
      userId: 'user-9',
    });
    const ui = mapQuestionnaireToUI(dto as never);
    expect(ui.schema.length).toBeGreaterThan(0);
  });

  it('keeps the schema empty when fallbackToTemplate is disabled', () => {
    const dto = buildFHIRPayload({
      form: { ...roundTripForm, schema: [] },
      orgId: 'org-1',
      userId: 'user-9',
      fallbackToTemplate: false,
    });
    const ui = mapQuestionnaireToUI(dto as never);
    expect(ui.schema).toEqual([]);
  });
});

describe('template source and date fallbacks', () => {
  const template = (overrides: Record<string, unknown>) =>
    ({
      id: 'tpl-x',
      organisationId: 'org-1',
      ownerUserId: null,
      kind: 'FORM',
      name: 'X',
      description: null,
      status: 'DRAFT',
      scope: 'ORGANISATION',
      rules: {},
      latestVersion: 1,
      publishedVersion: null,
      createdBy: 'u1',
      updatedBy: 'u1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    }) as never;

  it('falls back to ORG_TEMPLATE for clinical kinds without a source', () => {
    expect(mapTemplateToUI(template({ kind: 'SOAP_NOTE' })).templateSource).toBe('ORG_TEMPLATE');
    expect(mapTemplateToUI(template({ kind: 'VITAL_RECORD' })).templateSource).toBe('ORG_TEMPLATE');
    expect(mapTemplateToUI(template({ kind: 'FORM' })).templateSource).toBeUndefined();
  });

  it('prefers catalogItemIds over appliesTo links', () => {
    expect(
      mapTemplateToUI(
        template({
          catalogItemIds: ['ci-1'],
          rules: { appliesTo: { serviceIds: ['svc-1'] } },
        })
      ).services
    ).toEqual(['ci-1']);
  });

  it('tolerates invalid and numeric timestamps', () => {
    const invalid = mapTemplateToUI(template({ createdAt: 'not-a-date', updatedAt: 'also-bad' }));
    expect(invalid.lastUpdated).toBeTruthy();

    const numeric = mapTemplateToUI(
      template({ createdAt: 1735689600000, updatedAt: 1735689600000 })
    );
    expect(numeric.lastUpdated).toBeTruthy();
  });
});

describe('task block serialization edge cases', () => {
  const taskForm = (blockFields: FormField[]): FormsProps => ({
    name: 'Tasks',
    category: 'Task Template',
    usage: 'Internal',
    updatedBy: 'u1',
    lastUpdated: '',
    schema: [
      {
        id: 'task_blocks',
        type: 'group',
        label: 'Schedule tasks',
        meta: { taskGroup: true },
        fields: [
          {
            id: 'task-1',
            type: 'group',
            label: 'Fallback name',
            meta: { taskBlock: true },
            fields: blockFields,
          },
        ] as unknown as FormField[],
      },
    ] as unknown as FormField[],
  });

  const readBlocks = (form: FormsProps): Array<Record<string, unknown>> => {
    const snapshot = buildTemplateSchemaSnapshot(form, 'TASK_ASSIGNMENT');
    const schedule = snapshot.sections.find((section) => section.id === 'schedule');
    const taskBlocks = schedule?.fields.find((field) => field.key === 'taskBlocks');
    return (taskBlocks?.defaultValue ?? []) as Array<Record<string, unknown>>;
  };

  it('reads authored values from placeholders when defaults are empty', () => {
    const blocks = readBlocks(
      taskForm([
        {
          id: 'task-1_name',
          type: 'input',
          label: 'Task title',
          placeholder: 'Feed the patient',
          defaultValue: '',
          meta: { taskBlockKey: 'name' },
        },
      ] as unknown as FormField[])
    );
    expect(blocks[0].name).toBe('Feed the patient');
  });

  it('coerces dayOffset and invalid durations, ignoring unknown keys and object values', () => {
    const blocks = readBlocks(
      taskForm([
        {
          id: 'task-1_dayOffset',
          type: 'number',
          label: 'Day offset',
          defaultValue: '2',
          meta: { taskBlockKey: 'dayOffset' },
        },
        {
          id: 'task-1_durationDays',
          type: 'number',
          label: 'Duration',
          defaultValue: 'abc',
          meta: { taskBlockKey: 'durationDays' },
        },
        {
          id: 'task-1_timeOfDay',
          type: 'input',
          label: 'Time',
          defaultValue: '14:30',
          meta: { taskBlockKey: 'timeOfDay' },
        },
        {
          id: 'task-1_unknown',
          type: 'input',
          label: 'Unknown',
          defaultValue: 'x',
          meta: { taskBlockKey: 'somethingElse' },
        },
        {
          id: 'task-1_reminder',
          type: 'dropdown',
          label: 'Reminder',
          defaultValue: { odd: 'object' },
          meta: { taskBlockKey: 'reminderOffsetMinutes' },
        },
        {
          id: 'task-1_nokey',
          type: 'input',
          label: 'No key',
          defaultValue: 'ignored',
        },
      ] as unknown as FormField[])
    );

    expect(blocks[0].dayOffset).toBe(2);
    expect(blocks[0].durationDays).toBe(0);
    expect(blocks[0].timeOfDay).toBe('14:30');
    expect(blocks[0]).not.toHaveProperty('somethingElse');
    expect(blocks[0].reminderOffsetMinutes).toBeUndefined();
    expect(blocks[0].name).toBe('Fallback name');
  });

  it('drops task blocks whose name is blank', () => {
    const blocks = readBlocks(
      taskForm([
        {
          id: 'task-1_name',
          type: 'input',
          label: 'Task title',
          defaultValue: '   ',
          meta: { taskBlockKey: 'name' },
        },
      ] as unknown as FormField[])
    );
    // a blank explicit name overrides the group-label fallback, so the block is dropped
    expect(blocks).toHaveLength(0);
  });
});

describe('medication row field mapping edge cases', () => {
  const prescriptionForm = (fields: FormField[]): FormsProps => ({
    name: 'Rx',
    category: 'Prescription',
    usage: 'Internal',
    updatedBy: 'u1',
    lastUpdated: '',
    schema: [
      {
        id: 'medications',
        type: 'group',
        label: 'Medications',
        meta: { medicationGroup: true },
        fields: [
          {
            id: 'inv-2_group',
            type: 'group',
            label: 'Meloxicam',
            meta: { medicineId: 'inv-2' },
            fields,
          },
        ] as unknown as FormField[],
      },
    ] as unknown as FormField[],
  });

  const firstRow = (form: FormsProps): Record<string, unknown> => {
    const snapshot = buildTemplateSchemaSnapshot(form, 'PRESCRIPTION');
    const medications = snapshot.sections.find((section) => section.id === 'medications');
    const line = medications?.fields.find((field) => field.key === 'medicationLine') as {
      defaultValue?: Array<Record<string, unknown>>;
    };
    return line.defaultValue?.[0] ?? {};
  };

  it('maps id-suffix fields when prescriptionField meta is absent', () => {
    const row = firstRow(
      prescriptionForm([
        { id: 'inv-2_name', type: 'input', label: 'Name', defaultValue: 'Meloxicam' },
        { id: 'inv-2_price', type: 'number', label: 'Price', defaultValue: 12 },
        { id: 'inv-2_priceCents', type: 'number', label: 'Price cents', defaultValue: 1200 },
        { id: 'inv-2_brand', type: 'input', label: 'Brand', defaultValue: 'Metacam' },
        { id: 'inv-2_mystery', type: 'input', label: 'Mystery', defaultValue: 'x' },
      ] as unknown as FormField[])
    );

    expect(row.medicineName).toBe('Meloxicam');
    expect(row.price).toBe(12);
    expect(row.priceCents).toBe(1200);
    expect(row.brand).toBe('Metacam');
    expect(row.inventoryItemId).toBe('inv-2');
  });

  it('reads boolean and placeholder-backed values and skips empty fields', () => {
    const row = firstRow(
      prescriptionForm([
        {
          id: 'inv-2_controlled',
          type: 'input',
          label: 'Controlled',
          defaultValue: true,
          meta: { prescriptionField: 'controlledSubstance' },
        },
        {
          id: 'inv-2_route',
          type: 'input',
          label: 'Route',
          placeholder: 'Oral',
          meta: { prescriptionField: 'route' },
        },
        { id: 'inv-2_empty', type: 'input', label: 'Empty', defaultValue: '' },
      ] as unknown as FormField[])
    );

    expect(row.controlledSubstance).toBe(true);
    expect(row.route).toBe('Oral');
    expect(row.medicineName).toBe('Meloxicam');
  });
});

describe('mapFormToUI service and usage normalization', () => {
  const base = {
    _id: 'form-2',
    orgId: 'org-1',
    name: 'Form',
    description: '',
    category: 'Custom',
    status: 'draft',
    schema: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('normalizes a scalar serviceId into a list and legacy usage labels', () => {
    const mapped = mapFormToUI({
      ...base,
      serviceId: 'svc-1',
      visibilityType: 'Internal_External',
    } as never);
    expect(mapped.services).toEqual(['svc-1']);
    expect(mapped.usage).toBe('Internal & External');
  });

  it('keeps array serviceIds and defaults usage to Internal', () => {
    const mapped = mapFormToUI({ ...base, serviceId: ['svc-1', 'svc-2'] } as never);
    expect(mapped.services).toEqual(['svc-1', 'svc-2']);
    expect(mapped.usage).toBe('Internal');
  });
});
