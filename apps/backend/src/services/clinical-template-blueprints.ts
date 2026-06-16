import { TemplateKind } from "@prisma/client";

type BlueprintFieldType =
  | "text"
  | "textarea"
  | "datetime"
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

const clinicalBlueprints: Record<
  ClinicalTemplateKind,
  ClinicalTemplateSchemaSnapshot
> = {
  SOAP_NOTE: {
    sections: [
      {
        id: "subjective",
        title: "Subjective",
        order: 1,
        fields: [
          {
            key: "chiefComplaint",
            label: "Chief complaint",
            type: "textarea",
            required: true,
            order: 1,
          },
          {
            key: "history",
            label: "History",
            type: "richText",
            order: 2,
          },
          {
            key: "ownerConcern",
            label: "Owner concern",
            type: "text",
            order: 3,
          },
        ],
      },
      {
        id: "objective",
        title: "Objective",
        order: 2,
        fields: [
          {
            key: "vitals",
            label: "Vitals",
            type: "vitalRow",
            repeatable: true,
            order: 1,
            rules: {
              columns: ["label", "value", "unit"],
            },
          },
          {
            key: "examFindings",
            label: "Exam findings",
            type: "richText",
            order: 2,
          },
          {
            key: "testResults",
            label: "Test results",
            type: "table",
            order: 3,
            rules: {
              columns: ["testName", "result", "unit"],
            },
          },
        ],
      },
      {
        id: "assessment",
        title: "Assessment",
        order: 3,
        fields: [
          {
            key: "diagnoses",
            label: "Diagnoses",
            type: "diagnosis",
            required: true,
            repeatable: true,
            order: 1,
          },
          {
            key: "assessmentNotes",
            label: "Assessment notes",
            type: "richText",
            order: 2,
          },
          {
            key: "severity",
            label: "Severity",
            type: "select",
            order: 3,
            options: [
              { label: "Mild", value: "mild" },
              { label: "Moderate", value: "moderate" },
              { label: "Severe", value: "severe" },
            ],
            rules: {
              allowCustom: false,
            },
          },
        ],
      },
      {
        id: "plan",
        title: "Plan",
        order: 4,
        fields: [
          {
            key: "medications",
            label: "Medications",
            type: "medicationLine",
            required: true,
            repeatable: true,
            order: 1,
            rules: {
              columns: ["drug", "dose", "frequency", "duration"],
            },
          },
          {
            key: "procedures",
            label: "Procedures",
            type: "procedure",
            repeatable: true,
            order: 2,
            rules: {
              columns: ["procedure", "notes"],
            },
          },
          {
            key: "instructions",
            label: "Instructions",
            type: "instructionBlock",
            required: true,
            order: 3,
          },
          {
            key: "followUp",
            label: "Follow up",
            type: "datetime",
            order: 4,
          },
        ],
      },
    ],
  },
  PRESCRIPTION: {
    sections: [
      {
        id: "medications",
        title: "Medications",
        order: 1,
        fields: [
          {
            key: "prescribedItems",
            label: "Prescribed items",
            type: "medicationLine",
            repeatable: true,
            order: 1,
            rules: {
              columns: ["drug", "dose", "frequency", "duration"],
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
  },
  DISCHARGE_SUMMARY: {
    sections: [
      {
        id: "summary",
        title: "Summary",
        order: 1,
        fields: [
          {
            key: "summaryText",
            label: "Summary text",
            type: "richText",
            required: true,
            order: 1,
          },
        ],
      },
      {
        id: "diagnoses",
        title: "Diagnoses",
        order: 2,
        fields: [
          {
            key: "diagnosisItems",
            label: "Diagnosis items",
            type: "diagnosis",
            required: true,
            repeatable: true,
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
            key: "medicationLines",
            label: "Medication lines",
            type: "medicationLine",
            required: true,
            repeatable: true,
            order: 1,
            rules: {
              columns: ["drug", "dose", "frequency", "duration"],
            },
          },
        ],
      },
      {
        id: "follow_up",
        title: "Follow Up",
        order: 4,
        fields: [
          {
            key: "followUpDate",
            label: "Follow up date",
            type: "datetime",
            order: 1,
          },
        ],
      },
      {
        id: "instructions",
        title: "Instructions",
        order: 5,
        fields: [
          {
            key: "dischargeInstructions",
            label: "Discharge instructions",
            type: "instructionBlock",
            required: true,
            order: 1,
          },
        ],
      },
    ],
  },
  VITAL_RECORD: {
    sections: [
      {
        id: "measured_at",
        title: "Measured At",
        order: 1,
        fields: [
          {
            key: "measuredAt",
            label: "Measured at",
            type: "datetime",
            required: true,
            order: 1,
          },
        ],
      },
      {
        id: "vitals",
        title: "Vitals",
        order: 2,
        fields: [
          {
            key: "vitalRows",
            label: "Vital rows",
            type: "vitalRow",
            required: true,
            repeatable: true,
            order: 1,
            rules: {
              columns: ["label", "value", "unit"],
            },
          },
        ],
      },
      {
        id: "notes",
        title: "Notes",
        order: 3,
        fields: [
          {
            key: "recordNotes",
            label: "Record notes",
            type: "richText",
            order: 1,
          },
        ],
      },
      {
        id: "metadata",
        title: "Metadata",
        order: 4,
        fields: [
          {
            key: "recordedBy",
            label: "Recorded by",
            type: "text",
            order: 1,
          },
        ],
      },
    ],
  },
};

const kindToRequiredSectionIds: Record<ClinicalTemplateKind, string[]> = {
  SOAP_NOTE: ["subjective", "objective", "assessment", "plan"],
  PRESCRIPTION: ["medications", "instructions", "notes"],
  DISCHARGE_SUMMARY: [
    "summary",
    "diagnoses",
    "medications",
    "follow_up",
    "instructions",
  ],
  VITAL_RECORD: ["measured_at", "vitals", "notes", "metadata"],
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
