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
export type TemplateSource = 'YC_LIBRARY' | 'ORGANISATION' | 'USER';
export type TemplateContractKind =
  | 'SOAP_NOTE'
  | 'VITAL_RECORD'
  | 'DISCHARGE_SUMMARY'
  | 'PRESCRIPTION'
  | 'FORM'
  | 'CONSENT'
  | 'INPATIENT_SCHEDULE'
  | 'TASK_ASSIGNMENT';
export type TemplateKind = TemplateContractKind;
export type TemplateLegacyKind = 'TASK_TEMPLATE' | 'CARE_PATHWAY';
export type TemplateStorageKind =
  | 'FORM'
  | 'SOAP_NOTE'
  | 'VITAL_RECORD'
  | 'PRESCRIPTION'
  | 'DISCHARGE_SUMMARY'
  | TemplateLegacyKind;

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

export interface TemplateAppliesTo {
  serviceIds?: string[];
  packageIds?: string[];
  species?: string[];
  encounterModes?: Array<'OUTPATIENT' | 'INPATIENT'>;
  organisationTypes?: string[];
  specialityIds?: string[];
  defaultForKind?: boolean;
}

/**
 * Canonical clinical template structures — the single source of truth shared by the
 * frontend forms builder (CategoryTemplates), the frontend/backend clinical blueprints,
 * the appointment-workspace editors, and the backend resolver default library seed.
 *
 * Field keys MUST match the appointment-workspace editor keys (SoapStep / SummaryStep /
 * VitalsForm) so authored rich-text content round-trips losslessly between the builder and
 * the workspace. SOAP/Discharge free-text fields are rich text; vitals are measurements.
 *
 * Do not fork these shapes — derive every builder/blueprint/seed from these constants so the
 * "one contract on both sides" guarantee holds.
 */
export const CANONICAL_SOAP_STRUCTURE: TemplateSchemaSnapshot = {
  sections: [
    {
      id: 'subjective',
      title: 'Subjective',
      order: 1,
      fields: [
        { key: 'subjective', label: 'Subjective', type: 'richText', required: true, order: 1 },
      ],
    },
    {
      id: 'objective',
      title: 'Objective',
      order: 2,
      fields: [
        { key: 'objective', label: 'Objective', type: 'richText', required: true, order: 1 },
      ],
    },
    {
      id: 'assessment',
      title: 'Assessment',
      order: 3,
      fields: [
        { key: 'assessment', label: 'Assessment', type: 'richText', required: true, order: 1 },
      ],
    },
    {
      id: 'plan',
      title: 'Plan',
      order: 4,
      fields: [{ key: 'plan', label: 'Plan', type: 'richText', required: true, order: 1 }],
    },
  ],
};

export const CANONICAL_DISCHARGE_STRUCTURE: TemplateSchemaSnapshot = {
  sections: [
    {
      id: 'summary',
      title: 'Discharge summary',
      order: 1,
      fields: [
        {
          key: 'summaryText',
          label: 'Discharge summary',
          type: 'richText',
          required: true,
          order: 1,
        },
      ],
    },
    {
      id: 'home_care',
      title: 'Home care instructions',
      order: 2,
      fields: [{ key: 'homeCare', label: 'Home care instructions', type: 'richText', order: 1 }],
    },
    {
      id: 'medications',
      title: 'Medications',
      order: 3,
      fields: [{ key: 'dischargeMedications', label: 'Medications', type: 'richText', order: 1 }],
    },
    {
      id: 'follow_up',
      title: 'Follow up',
      order: 4,
      fields: [
        {
          key: 'followUpInDays',
          label: 'Follow-up in days',
          type: 'number',
          order: 1,
          rules: { unit: 'days' },
        },
      ],
    },
    {
      id: 'signature',
      title: 'Signature',
      order: 5,
      fields: [{ key: 'signature', label: 'Signature', type: 'signature', order: 1 }],
    },
  ],
};

export const CANONICAL_PRESCRIPTION_STRUCTURE: TemplateSchemaSnapshot = {
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
          required: true,
          order: 1,
          rules: {
            columns: [
              'inventoryItemId',
              'dosage',
              'frequency',
              'durationDays',
              'instructions',
              'qty',
            ],
          },
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
      fields: [
        {
          key: 'clinicalNotes',
          label: 'Clinical notes',
          type: 'richText',
          order: 1,
        },
      ],
    },
  ],
};

export const CANONICAL_VITALS_STRUCTURE: TemplateSchemaSnapshot = {
  sections: [
    {
      id: 'vitals',
      title: 'Vitals',
      order: 1,
      fields: [
        { key: 'weightLbs', label: 'Weight', type: 'number', order: 1, rules: { unit: 'lbs' } },
        { key: 'tempF', label: 'Temperature', type: 'number', order: 2, rules: { unit: '°F' } },
        {
          key: 'heartRateBpm',
          label: 'Heart rate',
          type: 'number',
          order: 3,
          rules: { unit: 'bpm' },
        },
        {
          key: 'respRateBpm',
          label: 'Respiratory rate',
          type: 'number',
          order: 4,
          rules: { unit: 'bpm' },
        },
        { key: 'crtSec', label: 'CRT', type: 'text', order: 5, rules: { unit: 'sec' } },
        { key: 'mucousMembrane', label: 'Mucous membrane', type: 'text', order: 6 },
        {
          key: 'painScore',
          label: 'Pain score',
          type: 'number',
          order: 7,
          rules: { unit: '/ 10' },
        },
        { key: 'bcs', label: 'BCS', type: 'number', order: 8, rules: { unit: '/ 9' } },
      ],
    },
    {
      id: 'notes',
      title: 'Notes',
      order: 2,
      fields: [{ key: 'notes', label: 'Notes', type: 'richText', order: 1 }],
    },
  ],
};

/** Ordered workspace SOAP editor keys (the four S/O/A/P rich-text fields). */
export const CANONICAL_SOAP_FIELD_KEYS = ['subjective', 'objective', 'assessment', 'plan'] as const;

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
  source?: TemplateSource;
  appliesTo?: TemplateAppliesTo | null;
  versions?: TemplateVersionLike[];
}

export interface TemplateResolveInput {
  organisationId: string;
  kind: TemplateContractKind;
  appointmentId?: string;
  encounterId?: string;
  companionId?: string;
  species?: string;
  serviceId?: string;
  packageId?: string;
  mode?: 'OUTPATIENT' | 'INPATIENT';
  ownerUserId?: string;
}

export interface TemplateResolveResponse {
  templateId: string;
  templateVersion: number;
  templateVersionId: string;
  source: TemplateSource;
  ownerUserId: string | null;
  kind: TemplateContractKind;
  name: string;
  schemaSnapshot: TemplateSchemaSnapshot;
  renderConfigSnapshot: Record<string, unknown> | null;
  validationSnapshot: Record<string, unknown> | null;
  appliesTo: TemplateAppliesTo | null;
  reason: string;
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

export const normalizeTemplateKind = (kind: TemplateStorageKind | string): TemplateKind => {
  switch (kind) {
    case 'TASK_TEMPLATE':
      return 'TASK_ASSIGNMENT';
    case 'CARE_PATHWAY':
      return 'INPATIENT_SCHEDULE';
    case 'SOAP_NOTE':
    case 'VITAL_RECORD':
    case 'DISCHARGE_SUMMARY':
    case 'PRESCRIPTION':
    case 'FORM':
    case 'CONSENT':
    case 'INPATIENT_SCHEDULE':
    case 'TASK_ASSIGNMENT':
      return kind;
    default:
      return kind as TemplateKind;
  }
};

export const toLegacyTemplateKind = (kind: TemplateKind): TemplateStorageKind => {
  switch (kind) {
    case 'TASK_ASSIGNMENT':
      return 'TASK_TEMPLATE';
    case 'INPATIENT_SCHEDULE':
      return 'CARE_PATHWAY';
    case 'CONSENT':
      return 'FORM';
    default:
      return kind;
  }
};

const QUESTIONNAIRE_TEMPLATE_KINDS = new Set<TemplateKind>([
  'FORM',
  'CONSENT',
  'SOAP_NOTE',
  'VITAL_RECORD',
  'PRESCRIPTION',
  'DISCHARGE_SUMMARY',
]);

const PLAN_DEFINITION_TEMPLATE_KINDS = new Set<TemplateKind>([
  'TASK_ASSIGNMENT',
  'INPATIENT_SCHEDULE',
]);

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

  if (field.type === 'richText') {
    // RichTextBuilder reads the prefill HTML from the top-level `defaultValue`
    // (not meta), so surface it here or the editor loses its content on reload.
    return { ...base, type: 'richtext', defaultValue: field.defaultValue } as FormField;
  }

  if (field.type === 'textarea') {
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
            : field.type === 'richtext'
              ? 'richText'
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

export const templateSchemaToFormFields = (snapshot: TemplateSchemaSnapshot): FormField[] =>
  snapshot.sections.map(sectionToFormField);

const templateToForm = (template: TemplateLike): Form => ({
  _id: template.id,
  orgId: template.organisationId ?? '',
  name: template.name,
  category: normalizeTemplateKind(template.kind),
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
  const kind = normalizeTemplateKind(template.kind);
  const extensions: Extension[] = [
    { url: TEMPLATE_KIND_EXTENSION_URL, valueString: kind },
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
  const kind = normalizeTemplateKind(template.kind);
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
          code: kind,
          display: kind,
        },
      ],
      text: kind,
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
      | TemplateStorageKind
      | undefined) ??
    (questionnaire.code?.[0]?.code as TemplateStorageKind | undefined) ??
    defaults?.kind ??
    'FORM';
  const normalizedKind = normalizeTemplateKind(kind);

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
    kind: normalizedKind,
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
      | TemplateStorageKind
      | undefined) ??
    (planDefinition.type?.coding?.[0]?.code as TemplateStorageKind | undefined) ??
    defaults?.kind ??
    'TASK_ASSIGNMENT';
  const normalizedKind = normalizeTemplateKind(kind);

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
    kind: normalizedKind,
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
