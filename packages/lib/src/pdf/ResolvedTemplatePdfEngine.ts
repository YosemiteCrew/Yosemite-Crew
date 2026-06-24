import { generatePdfWithMetadata } from './GenericPdfEngine.js';
import { buildKeyValue } from './templates/shared.js';
import type {
  ClinicalPdfRenderResult,
  GeneratePdfInput,
  KeyValueItem,
  PdfSectionContent,
  PdfSectionDefinition,
} from './types.js';

type TemplateFieldDefinitionLike = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  repeatable?: boolean;
  section?: string;
  order?: number;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  rules?: Record<string, unknown>;
  visibilityConditions?: Record<string, unknown>;
  source?: string;
  [key: string]: unknown;
};

type TemplateSectionLike = {
  id: string;
  title: string;
  description?: string;
  order?: number;
  fields: TemplateFieldDefinitionLike[];
  [key: string]: unknown;
};

type ResolvedTemplateLike = {
  templateId?: string;
  templateVersion?: number;
  templateVersionId?: string;
  source?: string;
  ownerUserId?: string | null;
  kind?: string;
  name: string;
  reason?: string;
  schemaSnapshot: {
    sections: TemplateSectionLike[];
  };
  renderConfigSnapshot?: Record<string, unknown> | null;
  validationSnapshot?: Record<string, unknown> | null;
  appliesTo?: unknown;
  [key: string]: unknown;
};

export type ResolvedTemplatePdfInput = {
  organization: GeneratePdfInput['organization'];
  template: ResolvedTemplateLike;
  data: Record<string, unknown>;
  title?: string;
  printedBy?: string;
  signature?: GeneratePdfInput['signature'];
};

const normalizeText = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join(', ');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferredKeys = ['signerName', 'signerRole', 'signerDegree', 'value', 'label', 'text'];

    const preferred = preferredKeys.map((key) => normalizeText(record[key])).filter(Boolean);

    if (preferred.length > 0) {
      return preferred.join(' ');
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  return '';
};

const toDateString = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  return normalizeText(value);
};

const isObjectArray = (value: unknown): value is Array<Record<string, unknown>> =>
  Array.isArray(value) &&
  value.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item));

const buildTableColumns = (
  field: TemplateFieldDefinitionLike,
  rows: Array<Record<string, unknown>>
): Array<{ header: string; width?: number }> => {
  const configuredColumns = field.rules?.['columns'];

  if (
    Array.isArray(configuredColumns) &&
    configuredColumns.every((column) => typeof column === 'string')
  ) {
    return configuredColumns.map((column) => ({ header: column }));
  }

  const keys = rows[0] ? Object.keys(rows[0]) : [];
  return keys.map((key) => ({ header: key }));
};

const buildTableRows = (
  columns: Array<{ header: string }>,
  rows: Array<Record<string, unknown>>
): string[][] =>
  rows.map((row) =>
    columns.map((column) => normalizeText(row[column.header] ?? row[column.header.toLowerCase()]))
  );

const buildTemplateMetadata = (template: ResolvedTemplateLike): KeyValueItem[] =>
  buildKeyValue([
    ['Template Name', template.name],
    ['Template Kind', template.kind],
    ['Template Version', template.templateVersion?.toString()],
    ['Template ID', template.templateId],
    ['Template Version ID', template.templateVersionId],
    ['Source', template.source],
    ['Owner User ID', template.ownerUserId ?? undefined],
    ['Reason', template.reason],
    ['Applies To', normalizeText(template.appliesTo)],
  ]);

const buildFieldParagraph = (label: string, value: unknown): string =>
  `${label}: ${normalizeText(value) || '—'}`;

const buildFieldContent = (
  field: TemplateFieldDefinitionLike,
  value: unknown
): PdfSectionContent[] => {
  const label = field.label.trim();
  const normalized = normalizeText(value);

  if (field.type === 'date' || field.type === 'datetime') {
    return [{ type: 'paragraph', text: buildFieldParagraph(label, toDateString(value)) }];
  }

  if (field.type === 'boolean') {
    return [
      {
        type: 'paragraph',
        text: buildFieldParagraph(label, value === true ? 'Yes' : 'No'),
      },
    ];
  }

  if (field.type === 'signature') {
    return [
      {
        type: 'paragraph',
        text: buildFieldParagraph(label, normalized || 'Signed electronically'),
      },
    ];
  }

  if (
    field.type === 'table' ||
    field.type === 'repeater' ||
    field.type === 'vitalRow' ||
    field.type === 'medicationLine'
  ) {
    if (isObjectArray(value)) {
      const columns = buildTableColumns(field, value);
      return [
        { type: 'paragraph', text: `${label}:` },
        {
          type: 'table',
          columns,
          rows: buildTableRows(columns, value),
        },
      ];
    }

    if (Array.isArray(value)) {
      const items = value.map((item) => normalizeText(item)).filter(Boolean);
      return [
        { type: 'paragraph', text: `${label}:` },
        {
          type: 'bullets',
          items: items.length ? items : ['—'],
        },
      ];
    }

    return [{ type: 'paragraph', text: buildFieldParagraph(label, normalized) }];
  }

  if (field.type === 'multiSelect') {
    if (Array.isArray(value)) {
      const items = value.map((item) => normalizeText(item)).filter(Boolean);
      return [
        { type: 'paragraph', text: `${label}:` },
        {
          type: 'bullets',
          items: items.length ? items : ['—'],
        },
      ];
    }
  }

  if (
    field.type === 'richText' ||
    field.type === 'textarea' ||
    field.type === 'instructionBlock' ||
    field.type === 'assessmentItem' ||
    field.type === 'planItem'
  ) {
    if (normalized) {
      return [
        { type: 'paragraph', text: `${label}:` },
        { type: 'richText', runs: normalized },
      ];
    }

    return [{ type: 'paragraph', text: buildFieldParagraph(label, '—') }];
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => normalizeText(item)).filter(Boolean);
    return [
      { type: 'paragraph', text: `${label}:` },
      {
        type: 'bullets',
        items: items.length ? items : ['—'],
      },
    ];
  }

  return [{ type: 'paragraph', text: buildFieldParagraph(label, normalized) }];
};

const buildTemplateSection = (
  section: TemplateSectionLike,
  data: Record<string, unknown>
): PdfSectionDefinition => {
  const content: PdfSectionContent[] = [];
  const fields = [...section.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (section.description) {
    content.push({
      type: 'paragraph',
      text: section.description,
    });
  }

  for (const field of fields) {
    content.push(...buildFieldContent(field, data[field.key]));
  }

  return {
    title: section.title,
    content,
  };
};

const buildGeneratePdfInput = (input: ResolvedTemplatePdfInput): GeneratePdfInput => {
  const template = input.template as ResolvedTemplateLike;
  const metadataGroups = [buildTemplateMetadata(template)];
  const sections = [...template.schemaSnapshot.sections]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((section) => buildTemplateSection(section, input.data));

  return {
    documentType: template.kind ?? 'template',
    title: input.title ?? template.name,
    organization: input.organization,
    metadataGroups,
    sections,
    printedBy: input.printedBy,
    signature: input.signature,
  };
};

export const generateResolvedTemplatePdfWithMetadata = async (
  input: ResolvedTemplatePdfInput
): Promise<ClinicalPdfRenderResult> => generatePdfWithMetadata(buildGeneratePdfInput(input));

export const generateResolvedTemplatePdf = async (
  input: ResolvedTemplatePdfInput
): Promise<Buffer> => (await generateResolvedTemplatePdfWithMetadata(input)).pdf;
