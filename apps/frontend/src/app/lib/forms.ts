import {
  CANONICAL_DISCHARGE_STRUCTURE,
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
  TemplateSchemaSnapshot,
  TemplateStatus,
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
  PRESCRIPTION: 'Prescription Template',
  DISCHARGE_SUMMARY: 'Discharge Form',
  TASK_ASSIGNMENT: 'Task Template',
  INPATIENT_SCHEDULE: 'Inpatient Schedule',
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
      schema: [],
      serviceId: template.catalogItemIds,
      createdBy: template.createdBy,
      updatedBy: template.updatedBy,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
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
    schema: mapFormToUI(questionnaireToForm(resource)).schema,
    serviceId: template.catalogItemIds,
    createdBy: template.createdBy,
    updatedBy: template.updatedBy,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
};

export const mapTemplateToUI = (template: TemplateLike): FormsProps => ({
  ...mapFormToUI(templateToForm(template)),
  category: templateKindToCategory(template.kind),
  status: templateStatusToLabel(template.status),
  templateId: template.id,
  templateKind: template.kind,
  templateSource: template.ownership,
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
  // Rich-text fields carry their prefill HTML on a top-level `defaultValue`
  // (written by RichTextBuilder). Persist it as the template field's
  // defaultValue so the editor + prefilled content round-trip on reload.
  const richTextDefault =
    field.type === 'richtext'
      ? (field as FormField & { defaultValue?: unknown }).defaultValue
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
    defaultValue: richTextDefault,
    rules: field.meta,
    source: 'USER',
  };
};

const fieldsToTemplateSection = (
  id: string,
  title: string,
  fields: FormField[] = [],
  order = 99
): TemplateSchemaSnapshot['sections'][number] => ({
  id,
  title,
  order,
  fields: fields.flatMap((field, index) => {
    if (field.type === 'group') {
      return (field.fields?.length ? field.fields : [field]).map((nested, nestedIndex) =>
        toTemplateField(nested, index + nestedIndex)
      );
    }
    return [toTemplateField(field, index)];
  }),
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

const cloneTemplateSchema = (schema: TemplateSchemaSnapshot): TemplateSchemaSnapshot => ({
  sections: schema.sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => ({ ...field })),
  })),
});

export const buildTemplateSchemaSnapshot = (
  form: FormsProps,
  kind = categoryToTemplateKind(form.category)
): TemplateSchemaSnapshot => {
  const customFields = form.schema?.length
    ? [fieldsToTemplateSection('custom_fields', 'Custom Fields', form.schema, 999)]
    : [];
  const blueprint = kind ? (clinicalBlueprints[kind] ?? workflowBlueprints[kind]) : undefined;
  if (blueprint) {
    return {
      sections: [...cloneTemplateSchema(blueprint).sections, ...customFields],
    };
  }
  return { sections: customFields };
};

export const buildTemplatePayload = (
  form: FormsProps,
  orgId: string
): Omit<TemplateUpsertInput, 'createdBy'> => {
  const kind = form.templateKind ?? categoryToTemplateKind(form.category) ?? 'FORM';
  return {
    organisationId: orgId,
    ownership: form.templateSource === 'USER_TEMPLATE' ? 'USER_TEMPLATE' : 'ORG_TEMPLATE',
    kind,
    name: form.name,
    description: form.description,
    scope: kind === 'INPATIENT_SCHEDULE' ? 'INPATIENT' : 'ORGANISATION',
    rules: {
      species: form.species ?? [],
      requiredSigner: form.requiredSigner,
      visibility: form.usage,
      category: form.category,
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
