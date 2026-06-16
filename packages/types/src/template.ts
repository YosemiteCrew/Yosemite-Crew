import type {
  Bundle,
  CodeableConcept,
  Extension,
  PlanDefinition,
  PlanDefinitionAction,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponse,
} from '@yosemite-crew/fhir';
import {
  fromFHIRQuestionnaire,
  fromFHIRQuestionnaireResponse,
  toFHIRQuestionnaire,
  toFHIRQuestionnaireResponse,
  type Form,
  type FormField,
  type FormSubmission,
} from './form';

export type TemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type TemplateScope =
  | 'ORGANISATION'
  | 'SPECIALITY'
  | 'SERVICE'
  | 'APPOINTMENT_KIND'
  | 'INPATIENT'
  | 'OUTPATIENT';
export type TemplateOwnershipType = 'YC_LIBRARY' | 'ORG_TEMPLATE' | 'USER_TEMPLATE';
export type TemplateKind =
  | 'FORM'
  | 'SOAP_NOTE'
  | 'VITAL_RECORD'
  | 'PRESCRIPTION'
  | 'DISCHARGE_SUMMARY'
  | 'TASK_TEMPLATE'
  | 'CARE_PATHWAY';

export type TemplateFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiSelect'
  | 'boolean'
  | 'signature'
  | 'table'
  | 'repeater'
  | 'observation'
  | 'vitalRow'
  | 'medicationLine'
  | 'diagnosis'
  | 'procedure'
  | 'instructionBlock'
  | 'assessmentItem'
  | 'planItem'
  | 'richText';

export type TemplateFieldSource = 'USER' | 'SYSTEM' | 'TASK' | 'FHIR';

export interface TemplateFieldOption {
  label: string;
  value: string;
}

export interface TemplateFieldDefinition {
  key: string;
  label: string;
  type: TemplateFieldType;
  required?: boolean;
  repeatable?: boolean;
  section?: string;
  order?: number;
  defaultValue?: unknown;
  options?: TemplateFieldOption[];
  rules?: Record<string, unknown>;
  visibilityConditions?: Record<string, unknown>;
  source?: TemplateFieldSource;
}

export interface TemplateSection {
  id: string;
  title: string;
  description?: string;
  order?: number;
  fields: TemplateFieldDefinition[];
}

export interface TemplateSchemaSnapshot {
  sections: TemplateSection[];
}

export interface TemplateVersionLike {
  id: string;
  version: number;
  schemaSnapshot: unknown;
  renderConfigSnapshot: unknown;
  validationSnapshot: unknown;
  publishedAt?: Date | null;
  createdBy: string;
}

export interface TemplateLike {
  id: string;
  organisationId: string | null;
  ownerUserId: string | null;
  ownership: TemplateOwnershipType;
  kind: TemplateKind;
  name: string;
  description: string | null;
  status: TemplateStatus;
  scope: TemplateScope;
  rules: unknown;
  latestVersion: number;
  publishedVersion: number | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  catalogItemIds?: string[];
  versions?: TemplateVersionLike[];
}

export interface TemplateCatalogLink {
  catalogItemId: string;
}

export interface TemplateInstanceLike {
  id: string;
  templateId: string;
  templateVersion: number;
  organisationId: string;
  appointmentId?: string | null;
  caseId?: string | null;
  encounterId?: string | null;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'SIGNED' | 'VOID';
  data: unknown;
  authorId?: string | null;
  signedBy?: string | null;
  signedAt?: Date | null;
  generatedPdfUrl?: string | null;
  generatedPdf?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateUpsertInput {
  organisationId?: string;
  ownerUserId?: string;
  ownership: TemplateOwnershipType;
  kind: TemplateKind;
  name: string;
  description?: string;
  scope: TemplateScope;
  rules?: Record<string, unknown> | null;
  schemaSnapshot: TemplateSchemaSnapshot;
  renderConfigSnapshot?: Record<string, unknown>;
  validationSnapshot?: Record<string, unknown>;
  createdBy: string;
  updatedBy?: string;
}

export interface TemplateInstanceUpsertInput {
  organisationId: string;
  appointmentId?: string;
  caseId?: string;
  encounterId?: string;
  authorId?: string;
  data: Record<string, unknown>;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'SIGNED' | 'VOID';
}

const TEMPLATE_KIND_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-kind';
const TEMPLATE_OWNERSHIP_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-ownership';
const TEMPLATE_SCOPE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-scope';
const TEMPLATE_ORGANISATION_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-organisation';
const TEMPLATE_OWNER_USER_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-owner-user';
const TEMPLATE_SCHEMA_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-schema-snapshot';
const TEMPLATE_RENDER_CONFIG_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-render-config-snapshot';
const TEMPLATE_VALIDATION_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-validation-snapshot';
const TEMPLATE_LATEST_VERSION_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-latest-version';
const TEMPLATE_PUBLISHED_VERSION_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-published-version';
const TEMPLATE_VERSION_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-version';
const TEMPLATE_INSTANCE_STATUS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-instance-status';
const TEMPLATE_INSTANCE_CASE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-instance-case';
const TEMPLATE_INSTANCE_APPOINTMENT_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-instance-appointment';
const TEMPLATE_INSTANCE_ENCOUNTER_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-instance-encounter';
const TEMPLATE_INSTANCE_GENERATED_PDF_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-instance-generated-pdf-url';
const TEMPLATE_INSTANCE_GENERATED_PDF_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/template-instance-generated-pdf';

const QUESTIONNAIRE_TEMPLATE_KINDS = new Set<TemplateKind>([
  'FORM',
  'SOAP_NOTE',
  'VITAL_RECORD',
  'PRESCRIPTION',
  'DISCHARGE_SUMMARY',
]);

const PLAN_DEFINITION_TEMPLATE_KINDS = new Set<TemplateKind>(['TASK_TEMPLATE', 'CARE_PATHWAY']);

const buildExtension = (url: string, value: unknown): Extension | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return { url, valueString: value };
  if (typeof value === 'number' && Number.isInteger(value)) {
    return { url, valueInteger: value };
  }
  return { url, valueString: JSON.stringify(value) };
};

const parseJson = <T>(value: unknown): T | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'object') return value as T;
  return undefined;
};

const getExtension = (extensions: Extension[] | undefined, url: string) =>
  extensions?.find((extension) => extension.url === url);

const getStringExtension = (extensions: Extension[] | undefined, url: string) =>
  getExtension(extensions, url)?.valueString;

const latestVersion = (template: TemplateLike) =>
  [...(template.versions ?? [])].sort((a, b) => b.version - a.version)[0];

const latestSchema = (template: TemplateLike): TemplateSchemaSnapshot => {
  const version = latestVersion(template);
  const snapshot = version?.schemaSnapshot;
  if (snapshot && typeof snapshot === 'object') {
    return snapshot as TemplateSchemaSnapshot;
  }
  return { sections: [] };
};

const fieldToFormField = (field: TemplateFieldDefinition): FormField => {
  const base = {
    id: field.key,
    label: field.label,
    required: field.required,
    order: field.order,
    group: field.section,
    meta: {
      defaultValue: field.defaultValue,
      rules: field.rules,
      visibilityConditions: field.visibilityConditions,
      source: field.source,
    },
  };

  if (field.type === 'multiSelect' || field.type === 'select') {
    return {
      ...base,
      type: field.type === 'multiSelect' ? 'checkbox' : 'dropdown',
      options: field.options ?? [],
      multiple: field.type === 'multiSelect' || field.repeatable,
    } as FormField;
  }

  if (field.type === 'signature') {
    return { ...base, type: 'signature' } as FormField;
  }

  if (field.type === 'date') {
    return { ...base, type: 'date' } as FormField;
  }

  if (field.type === 'boolean') {
    return { ...base, type: 'boolean' } as FormField;
  }

  if (field.type === 'number') {
    return { ...base, type: 'number' } as FormField;
  }

  if (field.type === 'textarea' || field.type === 'richText') {
    return { ...base, type: 'textarea' } as FormField;
  }

  return { ...base, type: 'input' } as FormField;
};

const sectionToFormField = (section: TemplateSection): FormField => ({
  id: section.id,
  type: 'group',
  label: section.title,
  fields: (section.fields ?? []).map(fieldToFormField),
});

const formFieldToTemplateField = (field: FormField): TemplateFieldDefinition => {
  const meta = field.meta ?? {};
  const options =
    'options' in field ? ((field as { options?: TemplateFieldOption[] }).options ?? []) : [];

  return {
    key: field.id,
    label: field.label,
    type:
      field.type === 'checkbox'
        ? 'multiSelect'
        : field.type === 'dropdown'
          ? 'select'
          : field.type === 'group'
            ? 'repeater'
            : (field.type as TemplateFieldType),
    required: field.required,
    repeatable:
      'multiple' in field ? Boolean((field as { multiple?: boolean }).multiple) : undefined,
    section: field.group,
    order: field.order,
    defaultValue: meta.defaultValue,
    options: options.length ? options : undefined,
    rules: meta.rules,
    visibilityConditions: meta.visibilityConditions,
    source: meta.source,
  };
};

const formFieldsToSchema = (fields: FormField[]): TemplateSchemaSnapshot => ({
  sections: fields.map((field) =>
    field.type === 'group'
      ? {
          id: field.id,
          title: field.label,
          fields: (field.fields ?? []).map(formFieldToTemplateField),
        }
      : {
          id: field.id,
          title: field.label,
          fields: [formFieldToTemplateField(field)],
        }
  ),
});

const templateSchemaToFormFields = (snapshot: TemplateSchemaSnapshot): FormField[] =>
  snapshot.sections.map(sectionToFormField);

const templateToForm = (template: TemplateLike): Form => ({
  _id: template.id,
  orgId: template.organisationId ?? '',
  name: template.name,
  category: template.kind,
  description: template.description ?? undefined,
  visibilityType: 'Internal',
  status:
    template.status === 'PUBLISHED'
      ? 'published'
      : template.status === 'ARCHIVED'
        ? 'archived'
        : 'draft',
  schema: templateSchemaToFormFields(latestSchema(template)),
  createdBy: template.createdBy,
  updatedBy: template.updatedBy,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
});

const buildTemplateExtensions = (template: TemplateLike): Extension[] => {
  const extensions: Extension[] = [
    { url: TEMPLATE_KIND_EXTENSION_URL, valueString: template.kind },
    { url: TEMPLATE_OWNERSHIP_EXTENSION_URL, valueString: template.ownership },
    { url: TEMPLATE_SCOPE_EXTENSION_URL, valueString: template.scope },
    { url: TEMPLATE_LATEST_VERSION_EXTENSION_URL, valueInteger: template.latestVersion },
  ];

  if (template.organisationId) {
    extensions.push({
      url: TEMPLATE_ORGANISATION_EXTENSION_URL,
      valueString: template.organisationId,
    });
  }

  if (template.ownerUserId) {
    extensions.push({
      url: TEMPLATE_OWNER_USER_EXTENSION_URL,
      valueString: template.ownerUserId,
    });
  }

  if (template.publishedVersion !== null) {
    extensions.push({
      url: TEMPLATE_PUBLISHED_VERSION_EXTENSION_URL,
      valueInteger: template.publishedVersion,
    });
  }

  const version = latestVersion(template);
  if (version) {
    extensions.push(
      { url: TEMPLATE_VERSION_EXTENSION_URL, valueInteger: version.version },
      {
        url: TEMPLATE_SCHEMA_EXTENSION_URL,
        valueString: JSON.stringify(version.schemaSnapshot ?? { sections: [] }),
      }
    );

    if (version.renderConfigSnapshot !== undefined) {
      extensions.push({
        url: TEMPLATE_RENDER_CONFIG_EXTENSION_URL,
        valueString: JSON.stringify(version.renderConfigSnapshot ?? {}),
      });
    }

    if (version.validationSnapshot !== undefined) {
      extensions.push({
        url: TEMPLATE_VALIDATION_EXTENSION_URL,
        valueString: JSON.stringify(version.validationSnapshot ?? {}),
      });
    }
  }

  return extensions;
};

const toQuestionnaireStatus = (status: TemplateStatus): Questionnaire['status'] => {
  switch (status) {
    case 'PUBLISHED':
      return 'active';
    case 'ARCHIVED':
      return 'retired';
    case 'DRAFT':
    default:
      return 'draft';
  }
};

const toPlanDefinitionStatus = (status: TemplateStatus): PlanDefinition['status'] => {
  switch (status) {
    case 'PUBLISHED':
      return 'active';
    case 'ARCHIVED':
      return 'retired';
    case 'DRAFT':
    default:
      return 'draft';
  }
};

const questionnaireStatusToTemplateStatus = (status: Questionnaire['status']): TemplateStatus => {
  switch (status) {
    case 'active':
      return 'PUBLISHED';
    case 'retired':
      return 'ARCHIVED';
    case 'draft':
    default:
      return 'DRAFT';
  }
};

const planDefinitionStatusToTemplateStatus = (status: PlanDefinition['status']): TemplateStatus => {
  switch (status) {
    case 'active':
      return 'PUBLISHED';
    case 'retired':
      return 'ARCHIVED';
    case 'draft':
    default:
      return 'DRAFT';
  }
};

const templateInstanceStatusToQuestionnaireStatus = (
  status: TemplateInstanceLike['status']
): QuestionnaireResponse['status'] => {
  switch (status) {
    case 'COMPLETED':
    case 'SIGNED':
      return 'completed';
    case 'VOID':
      return 'stopped';
    case 'IN_PROGRESS':
    case 'DRAFT':
    default:
      return 'in-progress';
  }
};

const questionnaireResponseToInstanceStatus = (status: QuestionnaireResponse['status']) => {
  switch (status) {
    case 'completed':
      return 'COMPLETED';
    case 'stopped':
    case 'entered-in-error':
      return 'VOID';
    case 'amended':
      return 'IN_PROGRESS';
    default:
      return 'IN_PROGRESS';
  }
};

const instanceToSubmission = (instance: TemplateInstanceLike): FormSubmission => ({
  _id: instance.id,
  formId: instance.templateId,
  formVersion: instance.templateVersion,
  appointmentId: instance.appointmentId ?? undefined,
  companionId: undefined,
  parentId: undefined,
  submittedBy: instance.authorId ?? undefined,
  answers:
    typeof instance.data === 'object' && instance.data && !Array.isArray(instance.data)
      ? (instance.data as Record<string, unknown>)
      : {},
  submittedAt: instance.updatedAt ?? instance.createdAt,
  signing:
    instance.signedBy || instance.signedAt
      ? {
          required: true,
          status: instance.signedAt ? 'SIGNED' : 'IN_PROGRESS',
          provider: 'DOCUMENSO',
          signer: instance.signedBy
            ? {
                userId: instance.signedBy,
                role: 'VET',
              }
            : undefined,
          signedAt: instance.signedAt ?? undefined,
        }
      : undefined,
});

const latestSchemaFromTemplate = (template: TemplateLike): TemplateSchemaSnapshot => {
  const version = latestVersion(template);
  const snapshot = version?.schemaSnapshot;
  if (snapshot && typeof snapshot === 'object') {
    return snapshot as TemplateSchemaSnapshot;
  }
  return { sections: [] };
};

const questionnaireResourceToSchemaSnapshot = (
  questionnaire: Questionnaire
): TemplateSchemaSnapshot => {
  const schema = parseJson<TemplateSchemaSnapshot>(
    getStringExtension(questionnaire.extension, TEMPLATE_SCHEMA_EXTENSION_URL)
  );
  if (schema?.sections?.length) return schema;

  return {
    sections: (questionnaire.item ?? []).map((item) => ({
      id: item.linkId,
      title: item.text ?? item.linkId,
      fields: (item.item ?? []).map(formFieldToTemplateFieldFromQuestionnaireItem),
    })),
  };
};

const formFieldToTemplateFieldFromQuestionnaireItem = (
  item: QuestionnaireItem
): TemplateFieldDefinition => ({
  key: item.linkId,
  label: item.text ?? item.linkId,
  type:
    item.type === 'choice'
      ? item.repeats
        ? 'multiSelect'
        : 'select'
      : item.type === 'boolean'
        ? 'boolean'
        : item.type === 'date'
          ? 'date'
          : item.type === 'dateTime'
            ? 'datetime'
            : item.type === 'attachment'
              ? 'signature'
              : item.type === 'text'
                ? 'textarea'
                : 'text',
  required: item.required,
  repeatable: item.repeats,
  options: item.answerOption?.flatMap((option) => {
    if (option.valueCoding) {
      return [
        {
          label: option.valueCoding.display ?? option.valueCoding.code ?? '',
          value: option.valueCoding.code ?? option.valueCoding.display ?? '',
        },
      ];
    }
    if (option.valueString) {
      return [{ label: option.valueString, value: option.valueString }];
    }
    return [];
  }),
});

const planDefinitionResourceToSchemaSnapshot = (
  planDefinition: PlanDefinition
): TemplateSchemaSnapshot => {
  const schema = parseJson<TemplateSchemaSnapshot>(
    getStringExtension(planDefinition.extension, TEMPLATE_SCHEMA_EXTENSION_URL)
  );
  if (schema?.sections?.length) return schema;

  return {
    sections: (planDefinition.action ?? []).map((action) => ({
      id: action.id ?? action.title ?? 'section',
      title: action.title ?? action.id ?? 'Section',
      fields: [],
    })),
  };
};

const addTemplateExtensions = <T extends Questionnaire | PlanDefinition>(
  resource: T,
  template: TemplateLike
): T =>
  ({
    ...resource,
    extension: [...(resource.extension ?? []), ...buildTemplateExtensions(template)],
  }) as T;

const templateToQuestionnaire = (template: TemplateLike): Questionnaire =>
  addTemplateExtensions(
    {
      ...toFHIRQuestionnaire(templateToForm(template)),
      status: toQuestionnaireStatus(template.status),
    },
    template
  );

const templateToPlanDefinition = (template: TemplateLike): PlanDefinition => {
  const schema = latestSchemaFromTemplate(template);
  const planDefinition: PlanDefinition = {
    resourceType: 'PlanDefinition',
    id: template.id,
    status: toPlanDefinitionStatus(template.status),
    name: template.name,
    title: template.name,
    description: template.description ?? undefined,
    type: {
      coding: [
        {
          system: 'https://yosemitecrew.com/fhir/CodeSystem/template-kind',
          code: template.kind,
          display: template.kind,
        },
      ],
      text: template.kind,
    } as CodeableConcept,
    extension: [
      ...buildTemplateExtensions(template),
      { url: TEMPLATE_SCHEMA_EXTENSION_URL, valueString: JSON.stringify(schema) },
    ],
    meta: {
      lastUpdated: template.updatedAt.toISOString(),
    },
    action: schema.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
    })) as PlanDefinitionAction[],
  };

  return planDefinition;
};

const questionnaireToTemplateSchemaSnapshot = (
  questionnaire: Questionnaire
): TemplateSchemaSnapshot => questionnaireResourceToSchemaSnapshot(questionnaire);

const planDefinitionToTemplateSchemaSnapshot = (
  planDefinition: PlanDefinition
): TemplateSchemaSnapshot => planDefinitionResourceToSchemaSnapshot(planDefinition);

const questionnaireToTemplateInput = (
  questionnaire: Questionnaire,
  defaults?: {
    createdBy: string;
    updatedBy?: string;
    organisationId?: string;
    ownerUserId?: string;
    ownership?: TemplateOwnershipType;
    scope?: TemplateScope;
    kind?: TemplateKind;
  }
): TemplateUpsertInput => {
  const form = fromFHIRQuestionnaire(questionnaire);
  const kind =
    (getStringExtension(questionnaire.extension, TEMPLATE_KIND_EXTENSION_URL) as
      | TemplateKind
      | undefined) ??
    (questionnaire.code?.[0]?.code as TemplateKind | undefined) ??
    defaults?.kind ??
    'FORM';

  return {
    organisationId:
      getStringExtension(questionnaire.extension, TEMPLATE_ORGANISATION_EXTENSION_URL) ??
      defaults?.organisationId,
    ownerUserId:
      getStringExtension(questionnaire.extension, TEMPLATE_OWNER_USER_EXTENSION_URL) ??
      defaults?.ownerUserId,
    ownership:
      (getStringExtension(questionnaire.extension, TEMPLATE_OWNERSHIP_EXTENSION_URL) as
        | TemplateOwnershipType
        | undefined) ??
      defaults?.ownership ??
      'ORG_TEMPLATE',
    kind,
    name: questionnaire.title ?? questionnaire.name ?? form.name,
    description: questionnaire.description ?? undefined,
    scope:
      (getStringExtension(questionnaire.extension, TEMPLATE_SCOPE_EXTENSION_URL) as
        | TemplateScope
        | undefined) ??
      defaults?.scope ??
      'ORGANISATION',
    rules: undefined,
    schemaSnapshot: questionnaireToTemplateSchemaSnapshot(questionnaire),
    renderConfigSnapshot: parseJson(
      getStringExtension(questionnaire.extension, TEMPLATE_RENDER_CONFIG_EXTENSION_URL)
    ),
    validationSnapshot: parseJson(
      getStringExtension(questionnaire.extension, TEMPLATE_VALIDATION_EXTENSION_URL)
    ),
    createdBy: defaults?.createdBy ?? form.createdBy,
    updatedBy: defaults?.updatedBy ?? defaults?.createdBy ?? form.updatedBy,
  };
};

const planDefinitionToTemplateInput = (
  planDefinition: PlanDefinition,
  defaults?: {
    createdBy: string;
    updatedBy?: string;
    organisationId?: string;
    ownerUserId?: string;
    ownership?: TemplateOwnershipType;
    scope?: TemplateScope;
    kind?: TemplateKind;
  }
): TemplateUpsertInput => {
  const kind =
    (getStringExtension(planDefinition.extension, TEMPLATE_KIND_EXTENSION_URL) as
      | TemplateKind
      | undefined) ??
    (planDefinition.type?.coding?.[0]?.code as TemplateKind | undefined) ??
    defaults?.kind ??
    'TASK_TEMPLATE';

  return {
    organisationId:
      getStringExtension(planDefinition.extension, TEMPLATE_ORGANISATION_EXTENSION_URL) ??
      defaults?.organisationId,
    ownerUserId:
      getStringExtension(planDefinition.extension, TEMPLATE_OWNER_USER_EXTENSION_URL) ??
      defaults?.ownerUserId,
    ownership:
      (getStringExtension(planDefinition.extension, TEMPLATE_OWNERSHIP_EXTENSION_URL) as
        | TemplateOwnershipType
        | undefined) ??
      defaults?.ownership ??
      'ORG_TEMPLATE',
    kind,
    name: planDefinition.title ?? planDefinition.name ?? 'Untitled workflow template',
    description: planDefinition.description ?? undefined,
    scope:
      (getStringExtension(planDefinition.extension, TEMPLATE_SCOPE_EXTENSION_URL) as
        | TemplateScope
        | undefined) ??
      defaults?.scope ??
      'ORGANISATION',
    rules: undefined,
    schemaSnapshot: planDefinitionToTemplateSchemaSnapshot(planDefinition),
    renderConfigSnapshot: parseJson(
      getStringExtension(planDefinition.extension, TEMPLATE_RENDER_CONFIG_EXTENSION_URL)
    ),
    validationSnapshot: parseJson(
      getStringExtension(planDefinition.extension, TEMPLATE_VALIDATION_EXTENSION_URL)
    ),
    createdBy: defaults?.createdBy ?? '',
    updatedBy: defaults?.updatedBy ?? defaults?.createdBy,
  };
};

const templateInstanceToQuestionnaireResponse = (
  instance: TemplateInstanceLike,
  template: TemplateLike
): QuestionnaireResponse => {
  const questionnaireResponse = toFHIRQuestionnaireResponse(
    instanceToSubmission(instance),
    templateSchemaToFormFields(latestSchemaFromTemplate(template))
  );

  return {
    ...questionnaireResponse,
    status: templateInstanceStatusToQuestionnaireStatus(instance.status),
    extension: [
      ...(questionnaireResponse.extension ?? []),
      { url: TEMPLATE_VERSION_EXTENSION_URL, valueInteger: instance.templateVersion },
      { url: TEMPLATE_INSTANCE_STATUS_EXTENSION_URL, valueString: instance.status },
      instance.caseId
        ? { url: TEMPLATE_INSTANCE_CASE_EXTENSION_URL, valueString: instance.caseId }
        : undefined,
      instance.encounterId
        ? { url: TEMPLATE_INSTANCE_ENCOUNTER_EXTENSION_URL, valueString: instance.encounterId }
        : undefined,
      instance.appointmentId
        ? { url: TEMPLATE_INSTANCE_APPOINTMENT_EXTENSION_URL, valueString: instance.appointmentId }
        : undefined,
      instance.generatedPdfUrl
        ? { url: TEMPLATE_INSTANCE_GENERATED_PDF_URL, valueString: instance.generatedPdfUrl }
        : undefined,
      instance.generatedPdf
        ? {
            url: TEMPLATE_INSTANCE_GENERATED_PDF_EXTENSION_URL,
            valueString: JSON.stringify(instance.generatedPdf),
          }
        : undefined,
    ].filter(Boolean) as Extension[],
  };
};

const questionnaireResponseToTemplateInstance = (
  response: QuestionnaireResponse,
  template: TemplateLike
): TemplateInstanceUpsertInput => {
  const submission = fromFHIRQuestionnaireResponse(
    response,
    templateSchemaToFormFields(latestSchemaFromTemplate(template))
  );

  return {
    organisationId:
      getStringExtension(response.extension, TEMPLATE_ORGANISATION_EXTENSION_URL) ??
      template.organisationId ??
      '',
    appointmentId: getStringExtension(
      response.extension,
      TEMPLATE_INSTANCE_APPOINTMENT_EXTENSION_URL
    ),
    caseId: getStringExtension(response.extension, TEMPLATE_INSTANCE_CASE_EXTENSION_URL),
    encounterId: getStringExtension(response.extension, TEMPLATE_INSTANCE_ENCOUNTER_EXTENSION_URL),
    authorId: submission.submittedBy || undefined,
    data: submission.answers,
    status: (() => {
      switch (response.status) {
        case 'completed':
          return 'COMPLETED';
        case 'stopped':
        case 'entered-in-error':
          return 'VOID';
        default:
          return 'IN_PROGRESS';
      }
    })(),
  };
};

const listBundle = <T>(
  resources: T[],
  resourceBuilder: (resource: T) => Questionnaire | PlanDefinition
): Bundle => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: resources.length,
  entry: resources.map((resource) => ({
    resource: resourceBuilder(resource),
  })),
});

export const templateMapper = {
  isQuestionnaireResourceKind(kind: TemplateKind) {
    return QUESTIONNAIRE_TEMPLATE_KINDS.has(kind);
  },
  isPlanDefinitionResourceKind(kind: TemplateKind) {
    return PLAN_DEFINITION_TEMPLATE_KINDS.has(kind);
  },
  listBundle,
  templateToQuestionnaire,
  templateToPlanDefinition,
  questionnaireToTemplateSchemaSnapshot,
  planDefinitionToTemplateSchemaSnapshot,
  questionnaireToTemplateInput,
  planDefinitionToTemplateInput,
  templateInstanceToQuestionnaireResponse,
  questionnaireResponseToTemplateInstance,
};
