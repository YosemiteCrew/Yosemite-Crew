import { TemplateKind } from "@prisma/client";

type BlueprintFieldType =
  | "text"
  | "textarea"
  | "datetime"
  | "date"
  | "number"
  | "select"
  | "multiSelect"
  | "boolean"
  | "signature"
  | "table"
  | "repeater"
  | "medicationLine"
  | "diagnosis"
  | "procedure"
  | "instructionBlock"
  | "assessmentItem"
  | "planItem"
  | "richText"
  | "vitalRow";

type BlueprintField = {
  key: string;
  label: string;
  type: BlueprintFieldType;
  required?: boolean;
  repeatable?: boolean;
  section?: string;
  order?: number;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  rules?: Record<string, unknown>;
  visibilityConditions?: Record<string, unknown>;
  source?: "USER" | "SYSTEM" | "TASK" | "FHIR";
};

type BlueprintSection = {
  id: string;
  title: string;
  description?: string;
  order?: number;
  fields: BlueprintField[];
};

export type ClinicalTemplateKind =
  | "SOAP_NOTE"
  | "PRESCRIPTION"
  | "DISCHARGE_SUMMARY"
  | "VITAL_RECORD";

export type ClinicalTemplateSchemaSnapshot = {
  sections: BlueprintSection[];
};

export type ClinicalTemplateBlueprintValidation = {
  requiredSectionIds: string[];
  missingSectionIds: string[];
  missingFieldPaths: string[];
  invalidFieldPaths: string[];
};

type SnapshotField = {
  key?: string;
  type?: BlueprintFieldType;
  repeatable?: boolean;
  options?: Array<{ label?: string; value?: string }>;
  rules?: Record<string, unknown>;
};

type SnapshotSection = {
  id?: string;
  fields?: SnapshotField[];
};

const SOAP_NOTE_BLUEPRINT: ClinicalTemplateSchemaSnapshot = {
  sections: [
    {
      id: "subjective",
      title: "Subjective",
      order: 1,
      fields: [
        {
          key: "subjective",
          label: "Subjective",
          type: "richText",
          required: true,
          order: 1,
        },
      ],
    },
    {
      id: "objective",
      title: "Objective",
      order: 2,
      fields: [
        {
          key: "objective",
          label: "Objective",
          type: "richText",
          required: true,
          order: 1,
        },
      ],
    },
    {
      id: "assessment",
      title: "Assessment",
      order: 3,
      fields: [
        {
          key: "assessment",
          label: "Assessment",
          type: "richText",
          required: true,
          order: 1,
        },
      ],
    },
    {
      id: "plan",
      title: "Plan",
      order: 4,
      fields: [
        {
          key: "plan",
          label: "Plan",
          type: "richText",
          required: true,
          order: 1,
        },
      ],
    },
  ],
};

const PRESCRIPTION_BLUEPRINT: ClinicalTemplateSchemaSnapshot = {
  sections: [
    {
      id: "medications",
      title: "Medications",
      order: 1,
      fields: [
        {
          key: "medicationLine",
          label: "Medication lines",
          type: "medicationLine",
          repeatable: true,
          required: true,
          order: 1,
          rules: {
            columns: [
              "inventoryItemId",
              "dosage",
              "frequency",
              "durationDays",
              "instructions",
              "qty",
            ],
          },
        },
      ],
    },
    {
      id: "instructions",
      title: "Instructions",
      order: 2,
      fields: [
        {
          key: "usageInstructions",
          label: "Usage instructions",
          type: "instructionBlock",
          order: 1,
        },
      ],
    },
    {
      id: "notes",
      title: "Notes",
      order: 3,
      fields: [
        {
          key: "clinicalNotes",
          label: "Clinical notes",
          type: "richText",
          order: 1,
        },
      ],
    },
  ],
};

const DISCHARGE_BLUEPRINT: ClinicalTemplateSchemaSnapshot = {
  sections: [
    {
      id: "summary",
      title: "Discharge summary",
      order: 1,
      fields: [
        {
          key: "summaryText",
          label: "Discharge summary",
          type: "richText",
          required: true,
          order: 1,
        },
      ],
    },
    {
      id: "home_care",
      title: "Home care instructions",
      order: 2,
      fields: [
        {
          key: "homeCare",
          label: "Home care instructions",
          type: "richText",
          order: 1,
        },
      ],
    },
    {
      id: "medications",
      title: "Medications",
      order: 3,
      fields: [
        {
          key: "dischargeMedications",
          label: "Medications",
          type: "richText",
          order: 1,
        },
      ],
    },
    {
      id: "follow_up",
      title: "Follow up",
      order: 4,
      fields: [
        {
          key: "followUpInDays",
          label: "Follow-up in days",
          type: "number",
          order: 1,
          rules: { unit: "days" },
        },
      ],
    },
    {
      id: "signature",
      title: "Signature",
      order: 5,
      fields: [
        {
          key: "signature",
          label: "Signature",
          type: "signature",
          order: 1,
        },
      ],
    },
  ],
};

const VITALS_BLUEPRINT: ClinicalTemplateSchemaSnapshot = {
  sections: [
    {
      id: "vitals",
      title: "Vitals",
      order: 1,
      fields: [
        {
          key: "weightLbs",
          label: "Weight",
          type: "number",
          order: 1,
          rules: { unit: "lbs" },
        },
        {
          key: "tempF",
          label: "Temperature",
          type: "number",
          order: 2,
          rules: { unit: "°F" },
        },
        {
          key: "heartRateBpm",
          label: "Heart rate",
          type: "number",
          order: 3,
          rules: { unit: "bpm" },
        },
        {
          key: "respRateBpm",
          label: "Respiratory rate",
          type: "number",
          order: 4,
          rules: { unit: "bpm" },
        },
        {
          key: "crtSec",
          label: "CRT",
          type: "text",
          order: 5,
          rules: { unit: "sec" },
        },
        {
          key: "mucousMembrane",
          label: "Mucous membrane",
          type: "text",
          order: 6,
        },
        {
          key: "painScore",
          label: "Pain score",
          type: "number",
          order: 7,
          rules: { unit: "/ 10" },
        },
        {
          key: "bcs",
          label: "BCS",
          type: "number",
          order: 8,
          rules: { unit: "/ 9" },
        },
      ],
    },
    {
      id: "notes",
      title: "Notes",
      order: 2,
      fields: [{ key: "notes", label: "Notes", type: "richText", order: 1 }],
    },
  ],
};

const clinicalBlueprints: Record<
  ClinicalTemplateKind,
  ClinicalTemplateSchemaSnapshot
> = {
  // Single-sourced inside the backend so the builder/seed/validation layer stays in lock-step.
  SOAP_NOTE: SOAP_NOTE_BLUEPRINT,
  PRESCRIPTION: PRESCRIPTION_BLUEPRINT,
  DISCHARGE_SUMMARY: DISCHARGE_BLUEPRINT,
  VITAL_RECORD: VITALS_BLUEPRINT,
};

const kindToRequiredSectionIds: Record<ClinicalTemplateKind, string[]> = {
  SOAP_NOTE: ["subjective", "objective", "assessment", "plan"],
  PRESCRIPTION: ["medications", "instructions", "notes"],
  DISCHARGE_SUMMARY: ["summary", "home_care", "medications", "follow_up"],
  VITAL_RECORD: ["vitals"],
};

const isClinicalTemplateKind = (
  kind: TemplateKind,
): kind is ClinicalTemplateKind =>
  kind === "SOAP_NOTE" ||
  kind === "PRESCRIPTION" ||
  kind === "DISCHARGE_SUMMARY" ||
  kind === "VITAL_RECORD";

const getSnapshotSections = (snapshot: unknown): SnapshotSection[] => {
  if (!snapshot || typeof snapshot !== "object" || !("sections" in snapshot)) {
    return [];
  }

  const sections = (snapshot as { sections?: unknown }).sections;

  return Array.isArray(sections) ? (sections as SnapshotSection[]) : [];
};

const getSnapshotSection = (
  sections: ReturnType<typeof getSnapshotSections>,
  sectionId: string,
) => sections.find((section) => section?.id?.trim() === sectionId);

const getSnapshotFields = (section: SnapshotSection | undefined) => {
  if (!section || !Array.isArray(section.fields)) {
    return [];
  }

  return section.fields;
};

const validateBlueprintField = (
  kind: ClinicalTemplateKind,
  sectionId: string,
  field: BlueprintField,
  snapshotField: SnapshotField | undefined,
) => {
  const issues: string[] = [];

  if (!snapshotField) {
    if (field.required) {
      issues.push(`${kind}.${sectionId}.${field.key}`);
    }

    return issues;
  }

  if (snapshotField.type !== field.type) {
    issues.push(`${kind}.${sectionId}.${field.key}.type`);
  }

  if (
    field.repeatable !== undefined &&
    snapshotField.repeatable !== field.repeatable
  ) {
    issues.push(`${kind}.${sectionId}.${field.key}.repeatable`);
  }

  if (field.options !== undefined) {
    const snapshotOptions = snapshotField.options ?? [];
    const expectedOptions = field.options;

    const optionsMatch =
      snapshotOptions.length === expectedOptions.length &&
      expectedOptions.every((option, index) => {
        const snapshotOption = snapshotOptions[index];
        return (
          snapshotOption?.label === option.label &&
          snapshotOption?.value === option.value
        );
      });

    if (!optionsMatch) {
      issues.push(`${kind}.${sectionId}.${field.key}.options`);
    }
  }

  if (field.rules !== undefined) {
    const snapshotRules = snapshotField.rules;
    if (!snapshotRules || typeof snapshotRules !== "object") {
      issues.push(`${kind}.${sectionId}.${field.key}.rules`);
    } else {
      const expectedRules = field.rules;
      const rulesMatch = Object.entries(expectedRules).every(([key, value]) => {
        const snapshotValue = Object.entries(snapshotRules).find(
          ([snapshotKey]) => snapshotKey === key,
        )?.[1];
        return JSON.stringify(snapshotValue) === JSON.stringify(value);
      });

      if (!rulesMatch) {
        issues.push(`${kind}.${sectionId}.${field.key}.rules`);
      }
    }
  }

  return issues;
};

export const getClinicalTemplateBlueprint = (
  kind: ClinicalTemplateKind,
): ClinicalTemplateSchemaSnapshot => clinicalBlueprints[kind];

export const buildClinicalTemplateSchemaSnapshot = (
  kind: ClinicalTemplateKind,
): ClinicalTemplateSchemaSnapshot => ({
  sections: clinicalBlueprints[kind].sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => ({ ...field })),
  })),
});

// FE-consumable default SOAP seed: four S/O/A/P sections, single-sourced from the backend
// canonical structure.
export const buildDefaultSoapNoteSchemaSnapshot =
  (): ClinicalTemplateSchemaSnapshot =>
    ({
      sections: SOAP_NOTE_BLUEPRINT.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) => ({ ...field })),
      })),
    }) as ClinicalTemplateSchemaSnapshot;

export const validateClinicalTemplateBlueprint = (
  kind: TemplateKind,
  snapshot: unknown,
): ClinicalTemplateBlueprintValidation => {
  if (!isClinicalTemplateKind(kind)) {
    return {
      requiredSectionIds: [],
      missingSectionIds: [],
      missingFieldPaths: [],
      invalidFieldPaths: [],
    };
  }

  const sections = getSnapshotSections(snapshot);

  const sectionIds = new Set(
    (sections ?? [])
      .map((section) => section?.id?.trim())
      .filter((id): id is string => Boolean(id)),
  );

  const requiredSectionIds = kindToRequiredSectionIds[kind];
  const missingSectionIds = requiredSectionIds.filter(
    (sectionId) => !sectionIds.has(sectionId),
  );

  const missingFieldPaths: string[] = [];
  const invalidFieldPaths: string[] = [];

  for (const section of clinicalBlueprints[kind].sections) {
    const snapshotSection = getSnapshotSection(sections, section.id);
    const snapshotFields = getSnapshotFields(snapshotSection);

    for (const blueprintField of section.fields) {
      const snapshotField = snapshotFields.find(
        (field) => field?.key?.trim() === blueprintField.key,
      );
      const issues = validateBlueprintField(
        kind,
        section.id,
        blueprintField,
        snapshotField,
      );

      for (const issue of issues) {
        if (
          issue.endsWith(".type") ||
          issue.endsWith(".repeatable") ||
          issue.endsWith(".options") ||
          issue.endsWith(".rules")
        ) {
          invalidFieldPaths.push(issue);
        } else {
          missingFieldPaths.push(issue);
        }
      }
    }
  }

  return {
    requiredSectionIds,
    missingSectionIds,
    missingFieldPaths,
    invalidFieldPaths,
  };
};

export const getClinicalTemplateKinds = () =>
  Object.keys(clinicalBlueprints) as ClinicalTemplateKind[];
