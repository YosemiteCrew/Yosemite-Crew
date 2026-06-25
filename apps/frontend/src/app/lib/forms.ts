import {
  CANONICAL_DISCHARGE_STRUCTURE,
  CANONICAL_PRESCRIPTION_STRUCTURE,
  CANONICAL_SOAP_STRUCTURE,
  CANONICAL_VITALS_STRUCTURE,
  Form,
  FormField,
  FormRequestDTO,
  FormResponseDTO,
  fromFormRequestDTO,
  templateMapper,
  toFormResponseDTO,
  TemplateKind,
  TemplateLike,
  TemplateFieldDefinition,
  TemplateSchemaSnapshot,
  templateSchemaToFormFields,
  TemplateStatus,
  TemplateOwnershipType,
  TemplateUpsertInput,
} from '@yosemite-crew/types';
import {
  CategoryTemplates,
  FormsCategory,
  FormsProps,
  FormsStatus,
  FormsUsage,
} from '@/app/features/forms/types/forms';
import { formatDisplayDate, formatTimeInPreferredTimeZone } from '@/app/lib/date';

const statusToLabelMap: Record<Form['status'], FormsStatus> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

const templateStatusToLabelMap: Record<TemplateStatus, FormsStatus> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

const templateKindToCategoryMap: Record<TemplateKind, FormsCategory> = {
  FORM: 'Custom',
  CONSENT: 'Consent form',
  SOAP_NOTE: 'SOAP',
  VITAL_RECORD: 'Vitals',
  PRESCRIPTION: 'Prescription',
  DISCHARGE_SUMMARY: 'Discharge Form',
  TASK_ASSIGNMENT: 'Task Template',
  INPATIENT_SCHEDULE: 'Inpatient Schedule',
};

const templateSourceToOwnership = (
  source?: FormsProps['templateSource']
): TemplateOwnershipType => {
  if (source === 'YC_LIBRARY') return 'YC_LIBRARY';
  if (source === 'USER_TEMPLATE') return 'USER_TEMPLATE';
  return 'ORG_TEMPLATE';
};

const labelToStatusMap: Record<FormsStatus, Form['status']> = {
  Draft: 'draft',
  Published: 'published',
  Archived: 'archived',
};

const toList = (val?: string | string[]): string[] => {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
};

const templateServicesFromLinks = (template: TemplateLike): string[] => {
  const catalogItemIds = template.catalogItemIds ?? [];
  if (catalogItemIds.length > 0) return catalogItemIds;

  const rules = template.rules as
    | {
        appliesTo?: {
          serviceIds?: unknown;
          packageIds?: unknown;
        };
      }
    | null
    | undefined;
  return [
    ...toStringList(rules?.appliesTo?.serviceIds),
    ...toStringList(rules?.appliesTo?.packageIds),
  ];
};

const asDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

const toStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    );
  }
  return typeof value === 'string' && value.trim().length > 0 ? [value] : [];
};

const SPECIES_LABELS = new Map<string, string>([
  ['canine', 'Canine'],
  ['feline', 'Feline'],
  ['equine', 'Equine'],
]);

const normalizeSpeciesValue = (value: string): string =>
  SPECIES_LABELS.get(value.trim().toLowerCase()) ?? value;

const normalizeSpeciesList = (value: unknown): string[] =>
  toStringList(value).map(normalizeSpeciesValue);

const normalizeUsageLabel = (usage: string): FormsUsage => {
  const normalized = usage.toLowerCase().replace(/[\s-]/g, '');
  if (
    normalized === 'internal&external' ||
    normalized === 'internal_external' ||
    normalized === 'interna_external'
  ) {
    return 'Internal & External';
  }
  return usage as FormsUsage;
};

export const formatDateLabel = (value?: Date | string): string => {
  return formatDisplayDate(value, '');
};

export const formatTimeLabel = (value?: Date | string): string => {
  return formatTimeInPreferredTimeZone(value, '');
};

export const statusToLabel = (status?: Form['status']): FormsStatus => {
  if (!status) return 'Draft';
  return statusToLabelMap[status] ?? 'Draft';
};

export const labelToStatus = (label?: FormsStatus): Form['status'] => {
  if (!label) return 'draft';
  return labelToStatusMap[label] ?? 'draft';
};

export const templateStatusToLabel = (status?: TemplateStatus): FormsStatus => {
  if (!status) return 'Draft';
  return templateStatusToLabelMap[status] ?? 'Draft';
};

export const templateKindToCategory = (kind?: TemplateKind): FormsCategory => {
  if (!kind) return 'Custom';
  return templateKindToCategoryMap[kind] ?? 'Custom';
};

export const categoryToTemplateKind = (category?: FormsCategory): TemplateKind | null => {
  switch (category) {
    case 'SOAP':
      return 'SOAP_NOTE';
    case 'Vitals':
      return 'VITAL_RECORD';
    case 'Prescription':
    case 'Prescription Template':
      return 'PRESCRIPTION';
    case 'Discharge Form':
      return 'DISCHARGE_SUMMARY';
    case 'Task Template':
      return 'TASK_ASSIGNMENT';
    case 'Inpatient Schedule':
      return 'INPATIENT_SCHEDULE';
    case 'Custom':
      return 'FORM';
    case 'Consent form':
      return 'CONSENT';
    default:
      return null;
  }
};

export const shouldUseTemplateApi = (form: Pick<FormsProps, 'category' | 'isTemplateBacked'>) =>
  Boolean(form.isTemplateBacked || categoryToTemplateKind(form.category));

const cloneField = (field: FormField): FormField => {
  if (field.type === 'group') {
    return {
      ...field,
      fields: (field.fields ?? []).map(cloneField),
    };
  }
  return { ...field };
};

export const getCategoryTemplate = (category: FormsCategory): FormField[] =>
  (CategoryTemplates[category] ?? []).map(cloneField);

export const hasSignatureField = (fields: FormField[] = []): boolean =>
  fields.some(
    (field) =>
      field.type === 'signature' ||
      (field.type === 'group' && hasSignatureField(field.fields ?? []))
  );

export const removeSignatureFields = (fields: FormField[] = []): FormField[] =>
  fields
    .filter((field) => field.type !== 'signature')
    .map((field) => {
      if (field.type !== 'group') return field;
      return {
        ...field,
        fields: removeSignatureFields(field.fields ?? []),
      };
    });

export const ensureSingleSignatureAtEnd = (
  fields: FormField[] = [],
  label = 'Signature'
): FormField[] => {
  const withoutSignatures = removeSignatureFields(fields);
  return [
    ...withoutSignatures,
    {
      id: 'signature',
      type: 'signature' as const,
      label,
    },
  ];
};

export const questionnaireToForm = (dto: FormResponseDTO): Form => {
  return fromFormRequestDTO(dto);
};

export const mapFormToUI = (form: Form): FormsProps => ({
  _id: form._id,
  orgId: form.orgId,
  name: form.name,
  description: form.description,
  businessType: (form as any).businessType,
  services: toList(form.serviceId),
  species: form.speciesFilter ?? [],
  category: form.category as FormsCategory,
  requiredSigner: form.requiredSigner ?? '',
  usage: normalizeUsageLabel(form.visibilityType ?? 'Internal'),
  updatedBy: form.updatedBy || '',
  lastUpdated: formatDateLabel(form.updatedAt ?? form.createdAt),
  status: statusToLabel(form.status),
  schema: (form.schema ?? []).map(cloneField),
});

export const mapQuestionnaireToUI = (dto: FormResponseDTO): FormsProps =>
  mapFormToUI(questionnaireToForm(dto));

const resolveTemplateStatus = (
  status: string,
  sectionCount: number
): 'published' | 'archived' | 'draft' => {
  if (sectionCount > 0 && status === 'PUBLISHED') return 'published';
  if (status === 'ARCHIVED') return 'archived';
  return 'draft';
};

const templateToForm = (template: TemplateLike): Form => {
  const sanitizePrescriptionSchema = (snapshot: TemplateSchemaSnapshot): TemplateSchemaSnapshot => {
    const sections = snapshot.sections.filter((section) => {
      if (section.fields.length > 0) return true;
      const title = section.title.trim().toLowerCase();
      return title !== 'instructions' && title !== 'notes';
    });
    return sections.length === snapshot.sections.length ? snapshot : { sections };
  };

  const latestSchemaFromTemplate = (): TemplateSchemaSnapshot => {
    const version = template.versions?.find(
      (item) =>
        item.version === template.publishedVersion || item.version === template.latestVersion
    );
    if (version?.schemaSnapshot && typeof version.schemaSnapshot === 'object') {
      const snapshot = version.schemaSnapshot as TemplateSchemaSnapshot;
      return template.kind === 'PRESCRIPTION' ? sanitizePrescriptionSchema(snapshot) : snapshot;
    }
    return { sections: [] };
  };

  if (templateMapper.isPlanDefinitionResourceKind(template.kind)) {
    const resource = templateMapper.templateToPlanDefinition(template);
    const input = templateMapper.planDefinitionToTemplateInput(resource, {
      createdBy: template.createdBy,
      updatedBy: template.updatedBy,
      organisationId: template.organisationId ?? undefined,
      ownerUserId: template.ownerUserId ?? undefined,
      ownership: template.ownership,
      scope: template.scope,
      kind: template.kind,
    });

    return {
      _id: template.id,
      orgId: template.organisationId ?? '',
      name: input.name,
      category: templateKindToCategory(input.kind),
      description: input.description,
      visibilityType: 'Internal',
      status: template.status === 'ARCHIVED' ? 'archived' : 'draft',
      schema: templateSchemaToFormFields(latestSchemaFromTemplate()),
      serviceId: templateServicesFromLinks(template),
      createdBy: template.createdBy,
      updatedBy: template.updatedBy,
      createdAt: asDate(template.createdAt),
      updatedAt: asDate(template.updatedAt),
    };
  }

  const resource = templateMapper.templateToQuestionnaire(template);
  const input = templateMapper.questionnaireToTemplateInput(resource, {
    createdBy: template.createdBy,
    updatedBy: template.updatedBy,
    organisationId: template.organisationId ?? undefined,
    ownerUserId: template.ownerUserId ?? undefined,
    ownership: template.ownership,
    scope: template.scope,
    kind: template.kind,
  });

  return {
    _id: template.id,
    orgId: template.organisationId ?? '',
    name: input.name,
    category: templateKindToCategory(input.kind),
    description: input.description,
    visibilityType: 'Internal',
    status: resolveTemplateStatus(template.status, input.schemaSnapshot.sections.length),
    schema: templateSchemaToFormFields(latestSchemaFromTemplate()),
    serviceId: templateServicesFromLinks(template),
    createdBy: template.createdBy,
    updatedBy: template.updatedBy,
    createdAt: asDate(template.createdAt),
    updatedAt: asDate(template.updatedAt),
  };
};

export const mapTemplateToUI = (template: TemplateLike): FormsProps => ({
  ...mapFormToUI(templateToForm(template)),
  species: normalizeSpeciesList(
    (template.rules as { appliesTo?: { species?: unknown }; species?: unknown } | null)?.appliesTo
      ?.species ?? (template.rules as { species?: unknown } | null)?.species
  ),
  category: templateKindToCategory(template.kind),
  status: templateStatusToLabel(template.status),
  templateId: template.id,
  templateKind: template.kind,
  templateSource: template.ownership ?? resolveTemplateSource(template),
  templateVersion: template.publishedVersion ?? template.latestVersion,
  isTemplateBacked: true,
});

type TemplateFieldType = TemplateSchemaSnapshot['sections'][number]['fields'][number]['type'];

const templateFieldTypeMap: Record<FormField['type'], TemplateFieldType> = {
  input: 'text',
  textarea: 'richText',
  richtext: 'richText',
  number: 'number',
  dropdown: 'select',
  radio: 'select',
  checkbox: 'multiSelect',
  boolean: 'boolean',
  date: 'date',
  signature: 'signature',
  group: 'repeater',
};

const toTemplateField = (
  field: FormField,
  index: number
): TemplateSchemaSnapshot['sections'][number]['fields'][number] => {
  const options = 'options' in field ? field.options : undefined;
  // Persist authored defaults so prefilled content round-trips on reload:
  //  • Rich-text fields carry prefill HTML on `defaultValue` (RichTextBuilder).
  //  • Medication-row fields (identified by `meta.inventoryItemId`) carry the inventory-sourced or
  //    author-typed default for name/strength/route/frequency/duration so the workspace
  //    prescription section can preload them when the template is applied.
  const fieldDefault = (field as FormField & { defaultValue?: unknown }).defaultValue;
  const persistedDefault =
    field.type === 'richtext' ||
    (field.meta as { inventoryItemId?: string } | undefined)?.inventoryItemId
      ? fieldDefault
      : undefined;
  return {
    key: field.id,
    label: field.label || field.id,
    type: templateFieldTypeMap[field.type],
    required: field.required,
    repeatable:
      field.type === 'group' || ('multiple' in field && Boolean(field.multiple)) || undefined,
    order: field.order ?? index + 1,
    options: options?.length ? options : undefined,
    defaultValue: persistedDefault,
    rules: field.meta,
    source: 'USER',
  };
};

const resolveTemplateSource = (template: TemplateLike): FormsProps['templateSource'] => {
  if (template.source === 'YC_LIBRARY') return 'YC_LIBRARY';
  if (template.source === 'USER') return 'USER_TEMPLATE';
  if (template.source === 'ORGANISATION') return 'ORG_TEMPLATE';
  if (
    template.kind === 'SOAP_NOTE' ||
    template.kind === 'DISCHARGE_SUMMARY' ||
    template.kind === 'PRESCRIPTION' ||
    template.kind === 'VITAL_RECORD'
  ) {
    return 'ORG_TEMPLATE';
  }
  return undefined;
};

const flattenTemplateFields = (fields: FormField[]): FormField[] =>
  fields.flatMap((field) => {
    if (field.type !== 'group') return [field];
    const children = flattenTemplateFields(field.fields ?? []);
    return children.length > 0 ? children : [];
  });

const fieldsToTemplateSection = (
  id: string,
  title: string,
  fields: FormField[] = [],
  order = 99
): TemplateSchemaSnapshot['sections'][number] => ({
  id,
  title,
  order,
  fields: flattenTemplateFields(fields).map((field, index) => toTemplateField(field, index)),
});

const clinicalBlueprints: Partial<Record<TemplateKind, TemplateSchemaSnapshot>> = {
  // Single-sourced from @yosemite-crew/types so the builder, workspace editors, and the
  // backend resolver/validation blueprint all agree on keys + rich-text field types.
  SOAP_NOTE: CANONICAL_SOAP_STRUCTURE,
  PRESCRIPTION: {
    sections: [
      {
        id: 'medications',
        title: 'Medications',
        order: 1,
        fields: [
          {
            key: 'prescribedItems',
            label: 'Prescribed items',
            type: 'medicationLine',
            repeatable: true,
            order: 1,
            rules: { columns: ['drug', 'dose', 'frequency', 'duration'] },
          },
        ],
      },
      {
        id: 'instructions',
        title: 'Instructions',
        order: 2,
        fields: [
          {
            key: 'usageInstructions',
            label: 'Usage instructions',
            type: 'instructionBlock',
            order: 1,
          },
        ],
      },
      {
        id: 'notes',
        title: 'Notes',
        order: 3,
        fields: [{ key: 'clinicalNotes', label: 'Clinical notes', type: 'richText', order: 1 }],
      },
    ],
  },
  DISCHARGE_SUMMARY: CANONICAL_DISCHARGE_STRUCTURE,
  VITAL_RECORD: CANONICAL_VITALS_STRUCTURE,
};

const workflowBlueprints: Partial<Record<TemplateKind, TemplateSchemaSnapshot>> = {
  TASK_ASSIGNMENT: {
    sections: [
      {
        id: 'definition',
        title: 'Task Definition',
        order: 1,
        fields: [
          {
            key: 'taskKind',
            label: 'Task kind',
            type: 'select',
            required: true,
            options: [
              { label: 'Medication', value: 'MEDICATION' },
              { label: 'Observation tool', value: 'OBSERVATION_TOOL' },
              { label: 'Hygiene', value: 'HYGIENE' },
              { label: 'Diet', value: 'DIET' },
              { label: 'Custom', value: 'CUSTOM' },
            ],
            rules: { allowCustom: false },
          },
          { key: 'category', label: 'Category', type: 'text', required: true },
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'description', label: 'Description', type: 'richText' },
        ],
      },
      {
        id: 'assignment',
        title: 'Assignment',
        order: 2,
        fields: [
          {
            key: 'audience',
            label: 'Audience',
            type: 'select',
            required: true,
            options: [
              { label: 'Employee task', value: 'EMPLOYEE_TASK' },
              { label: 'Parent task', value: 'PARENT_TASK' },
            ],
            rules: { allowCustom: false },
          },
          {
            key: 'defaultAssigneeRole',
            label: 'Default assignee role',
            type: 'select',
            options: [
              { label: 'Employee task', value: 'EMPLOYEE_TASK' },
              { label: 'Parent task', value: 'PARENT_TASK' },
            ],
            rules: { allowCustom: false },
          },
          { key: 'syncWithCalendar', label: 'Sync with calendar', type: 'boolean' },
        ],
      },
      {
        id: 'timing',
        title: 'Timing',
        order: 3,
        fields: [
          { key: 'dueOffsetMinutes', label: 'Due offset minutes', type: 'number', required: true },
          {
            key: 'defaultReminderOffsetMinutes',
            label: 'Default reminder offset minutes',
            type: 'number',
          },
          {
            key: 'recurrence',
            label: 'Recurrence',
            type: 'select',
            options: [
              { label: 'Once', value: 'ONCE' },
              { label: 'Daily', value: 'DAILY' },
              { label: 'Weekly', value: 'WEEKLY' },
              { label: 'Custom', value: 'CUSTOM' },
            ],
            rules: { allowCustom: false },
          },
        ],
      },
    ],
  },
  INPATIENT_SCHEDULE: {
    sections: [
      {
        id: 'admission',
        title: 'Admission',
        order: 1,
        fields: [
          {
            key: 'admissionOffsetMinutes',
            label: 'Admission offset minutes',
            type: 'number',
            required: true,
          },
          {
            key: 'anchor',
            label: 'Anchor',
            type: 'select',
            options: [
              { label: 'Admission', value: 'ADMISSION' },
              { label: 'Stay', value: 'STAY' },
              { label: 'Discharge', value: 'DISCHARGE' },
            ],
            rules: { allowCustom: false },
          },
        ],
      },
      {
        id: 'schedule',
        title: 'Schedule',
        order: 2,
        fields: [
          {
            key: 'taskBlocks',
            label: 'Task blocks',
            type: 'repeater',
            required: true,
            repeatable: true,
            rules: {
              columns: ['dayOffset', 'timeOfDay', 'taskKind', 'category', 'name', 'audience'],
            },
          },
        ],
      },
      {
        id: 'discharge',
        title: 'Discharge',
        order: 3,
        fields: [
          { key: 'dischargeOffsetMinutes', label: 'Discharge offset minutes', type: 'number' },
          { key: 'followUpTaskName', label: 'Follow-up task name', type: 'text' },
          { key: 'signOffRequired', label: 'Sign-off required', type: 'boolean' },
        ],
      },
    ],
  },
};

const mergeFieldDefaults = (
  blueprint: TemplateSchemaSnapshot,
  fields: FormField[]
): TemplateSchemaSnapshot => {
  const authoredById = new Map<string, FormField>();
  const collectAuthoredFields = (items: FormField[]): void => {
    for (const field of items) {
      authoredById.set(field.id, field);
      if (field.type === 'group') {
        collectAuthoredFields(field.fields ?? []);
      }
    }
  };
  collectAuthoredFields(fields);

  return {
    sections: blueprint.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        const authored = authoredById.get(field.key);
        if (!authored) return { ...field };

        const authoredDefault = (authored as FormField & { defaultValue?: unknown }).defaultValue;
        const authoredRules = authored.meta ?? {};
        return {
          ...field,
          label: authored.label || field.label,
          required: authored.required ?? field.required,
          defaultValue:
            authoredDefault === undefined || authoredDefault === ''
              ? field.defaultValue
              : authoredDefault,
          rules: {
            ...field.rules,
            ...authoredRules,
          },
        };
      }),
    })),
  };
};

type TaskBlockValue = {
  id?: string;
  dayOffset: number;
  timeOfDay: string;
  taskKind: string;
  category: string;
  name: string;
  audience: string;
  assignedRole?: string;
  reminderOffsetMinutes?: number;
  additionalNotes?: string;
  recurrence?: {
    type: string;
  };
};

const coerceNumberValue = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const fieldAuthoredValue = (field: FormField): unknown => {
  const defaultValue = (field as FormField & { defaultValue?: unknown }).defaultValue;
  if (defaultValue !== undefined && defaultValue !== '') return defaultValue;
  return field.placeholder;
};

const assignTaskBlockValue = (
  block: TaskBlockValue,
  key: string | undefined,
  value: unknown
): void => {
  if (!key || value === undefined || value === '') return;
  if (key === 'dayOffset') {
    block.dayOffset = coerceNumberValue(value, 0);
  } else if (key === 'reminderOffsetMinutes') {
    block.reminderOffsetMinutes = coerceNumberValue(value, 0);
  } else if (key === 'recurrence.type') {
    if (typeof value === 'string' || typeof value === 'number') {
      block.recurrence = { type: String(value) };
    }
  } else if (key in block) {
    (block as Record<string, unknown>)[key] = value;
  }
};

const taskBlockFromGroup = (group: FormField & { fields?: FormField[] }): TaskBlockValue => {
  const block: TaskBlockValue = {
    id: group.id,
    dayOffset: 0,
    timeOfDay: '09:00',
    taskKind: 'CUSTOM',
    category: 'CARE',
    name: group.label || 'Task',
    audience: 'EMPLOYEE_TASK',
    assignedRole: 'EMPLOYEE_TASK',
    recurrence: { type: 'ONCE' },
  };

  for (const field of group.fields ?? []) {
    const key = (field.meta as { taskBlockKey?: string } | undefined)?.taskBlockKey;
    assignTaskBlockValue(block, key, fieldAuthoredValue(field));
  }

  return block;
};

const taskBlocksFromForm = (form: FormsProps): TaskBlockValue[] =>
  (form.schema ?? [])
    .flatMap((field) =>
      field.meta?.taskGroup && field.type === 'group' ? (field.fields ?? []) : []
    )
    .filter(
      (field): field is FormField & { type: 'group'; fields?: FormField[] } =>
        field.type === 'group' &&
        (Boolean(field.meta?.taskBlock) ||
          field.fields?.some((nested) => Boolean(nested.meta?.taskBlockKey)))
    )
    .map(taskBlockFromGroup)
    .filter((block) => block.name.trim().length > 0);

const withTaskBlocks = (
  snapshot: TemplateSchemaSnapshot,
  taskBlocks: TaskBlockValue[]
): TemplateSchemaSnapshot => ({
  sections: snapshot.sections.map((section) => {
    if (section.id !== 'schedule') return section;
    return {
      ...section,
      fields: section.fields.map((field) =>
        field.key === 'taskBlocks' ? { ...field, defaultValue: taskBlocks } : field
      ),
    };
  }),
});

const getBlueprintFieldKeys = (snapshot?: TemplateSchemaSnapshot): Set<string> => {
  if (!snapshot) return new Set();
  return new Set(snapshot.sections.flatMap((section) => section.fields.map((field) => field.key)));
};

const filterCustomFields = (blueprintKeys: Set<string>, fields: FormField[] = []): FormField[] =>
  fields.flatMap<FormField>((field) => {
    if (field.type !== 'group') {
      return blueprintKeys.has(field.id) ? [] : [field];
    }

    const filteredChildren = filterCustomFields(blueprintKeys, field.fields ?? []);
    if (filteredChildren.length === 0) return [];
    return [{ ...(field as FormField), fields: filteredChildren }];
  });

type MedicationRow = {
  inventoryItemId?: string;
  medicineId?: string;
  medicineName?: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  durationDays?: string;
  instructions?: string;
  qty?: string;
  price?: string | number;
};

const medicationFieldValue = (field: FormField): string | number | undefined => {
  const defaultValue = (field as FormField & { defaultValue?: unknown }).defaultValue;
  if (typeof defaultValue === 'string' && defaultValue.trim().length > 0) return defaultValue;
  if (typeof defaultValue === 'number') return defaultValue;
  if (typeof field.placeholder === 'string' && field.placeholder.trim().length > 0) {
    return field.placeholder;
  }
  return undefined;
};

const medicationRowFromGroup = (group: FormField & { fields?: FormField[] }): MedicationRow => {
  const row: MedicationRow = {
    inventoryItemId: (group.meta?.inventoryItemId as string | undefined) ?? group.meta?.medicineId,
    medicineId: (group.meta?.medicineId as string | undefined) ?? group.meta?.inventoryItemId,
    medicineName: (group.meta?.medicineName as string | undefined) ?? group.label,
  };

  for (const field of group.fields ?? []) {
    const value = medicationFieldValue(field);
    if (value === undefined) continue;
    if (field.id.endsWith('_name')) row.medicineName = String(value);
    else if (field.id.endsWith('_dosage')) row.dosage = String(value);
    else if (field.id.endsWith('_route')) row.route = String(value);
    else if (field.id.endsWith('_frequency')) row.frequency = String(value);
    else if (field.id.endsWith('_duration')) row.durationDays = String(value);
    else if (field.id.endsWith('_qty')) row.qty = String(value);
    else if (field.id.endsWith('_price')) row.price = value;
    else if (field.id.endsWith('_remark') || field.id.endsWith('_instructions')) {
      row.instructions = String(value);
    }
  }

  return row;
};

const collectMedicationRows = (fields: FormField[] = []): MedicationRow[] => {
  const rows: MedicationRow[] = [];
  const walk = (items: FormField[]): void => {
    for (const item of items) {
      if (item.type === 'group') {
        if ((item.meta as { medicineId?: string } | undefined)?.medicineId) {
          rows.push(medicationRowFromGroup(item));
          continue;
        }
        walk(item.fields ?? []);
      }
    }
  };
  walk(fields);
  return rows;
};

const buildPrescriptionTemplateSnapshot = (form: FormsProps): TemplateSchemaSnapshot => {
  const rows = collectMedicationRows(form.schema ?? []);
  const snapshot = {
    sections: CANONICAL_PRESCRIPTION_STRUCTURE.sections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => ({ ...field })),
    })),
  } satisfies TemplateSchemaSnapshot;
  const medicationsSection = snapshot.sections.find((section) => section.id === 'medications');
  const medicationLine = medicationsSection?.fields.find((field) => field.key === 'medicationLine');
  if (medicationLine) {
    (medicationLine as TemplateFieldDefinition & { defaultValue?: MedicationRow[] }).defaultValue =
      rows;
  }
  return snapshot;
};

export const buildTemplateSchemaSnapshot = (
  form: FormsProps,
  kind = categoryToTemplateKind(form.category)
): TemplateSchemaSnapshot => {
  if (kind === 'PRESCRIPTION') {
    return buildPrescriptionTemplateSnapshot(form);
  }
  const blueprint = kind ? (clinicalBlueprints[kind] ?? workflowBlueprints[kind]) : undefined;
  if (blueprint) {
    const mergedBlueprint = mergeFieldDefaults(blueprint, form.schema ?? []);
    const customFields = filterCustomFields(getBlueprintFieldKeys(blueprint), form.schema ?? []);
    if (kind === 'INPATIENT_SCHEDULE') {
      const taskBlocks = taskBlocksFromForm(form);
      return {
        sections: [...withTaskBlocks(mergedBlueprint, taskBlocks).sections],
      };
    }
    const customSections = customFields.length
      ? [fieldsToTemplateSection('custom_fields', 'Custom Fields', customFields, 999)]
      : [];
    return {
      sections: [...mergedBlueprint.sections, ...customSections],
    };
  }
  const customFields = form.schema?.length
    ? [fieldsToTemplateSection('custom_fields', 'Custom Fields', form.schema, 999)]
    : [];
  return { sections: customFields };
};

export const buildTemplatePayload = (
  form: FormsProps,
  orgId: string
): Omit<TemplateUpsertInput, 'createdBy'> => {
  const kind = form.templateKind ?? categoryToTemplateKind(form.category) ?? 'FORM';
  const ownership = templateSourceToOwnership(form.templateSource);
  const isInpatientScoped =
    kind === 'INPATIENT_SCHEDULE' ||
    kind === 'TASK_ASSIGNMENT' ||
    form.category === 'Task Template' ||
    form.category === 'Inpatient Schedule';
  // The selected catalog item ids are a mix of services and packages; the backend resolver/
  // catalog-link sync (handoff §1) keys off both lists, so we send the same ids under each and
  // let the backend disambiguate against the catalog. Inpatient-only categories also constrain
  // the encounter mode so resolution never surfaces them in an out-patient workspace.
  const linkedCatalogIds = form.services ?? [];
  return {
    organisationId: ownership === 'YC_LIBRARY' ? undefined : orgId,
    ownership,
    kind,
    name: form.name,
    description: form.description,
    scope: isInpatientScoped ? 'INPATIENT' : 'ORGANISATION',
    rules: {
      species: form.species ?? [],
      requiredSigner: form.requiredSigner,
      visibility: form.usage,
      category: form.category,
      appliesTo: {
        serviceIds: linkedCatalogIds,
        packageIds: linkedCatalogIds,
        species: form.species ?? [],
        encounterModes: isInpatientScoped ? ['INPATIENT'] : undefined,
      },
    },
    schemaSnapshot: buildTemplateSchemaSnapshot(form, kind),
    renderConfigSnapshot: {
      title: form.name,
      category: form.category,
    },
    validationSnapshot: {},
    updatedBy: form.updatedBy,
  };
};

type BuildPayloadArgs = {
  form: FormsProps;
  orgId: string;
  userId: string;
  fallbackToTemplate?: boolean;
};

export const buildFHIRPayload = ({
  form,
  orgId,
  userId,
  fallbackToTemplate = true,
}: BuildPayloadArgs): FormRequestDTO => {
  const hasSchema = Boolean(form.schema?.length);
  const templateSchema = !hasSchema && fallbackToTemplate ? getCategoryTemplate(form.category) : [];
  const schema = hasSchema ? form.schema : templateSchema;

  const now = new Date();
  const usage = form.usage ?? 'Internal';
  const visibilityType = (
    usage === 'Internal & External' ? 'Internal_External' : usage
  ) as Form['visibilityType']; // backend supports Internal_External; local types lag

  const normalized: Form & { businessType?: any } = {
    _id: form._id ?? '',
    orgId: orgId,
    name: form.name,
    category: form.category,
    description: form.description,
    visibilityType,
    serviceId: form.services?.length ? form.services : undefined,
    speciesFilter: form.species?.length ? form.species : undefined,
    requiredSigner: form.requiredSigner || undefined,
    status: labelToStatus(form.status),
    schema,
    createdBy: (form as any).createdBy || userId,
    updatedBy: userId,
    createdAt: (form as any).createdAt || now,
    updatedAt: now,
    businessType: form.businessType,
  };

  return toFormResponseDTO(normalized);
};
