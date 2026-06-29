import { TemplateKind } from "@prisma/client";

type BlueprintFieldType =
  | "text"
  | "textarea"
  | "number"
  | "datetime"
  | "select"
  | "multiSelect"
  | "boolean"
  | "table"
  | "repeater"
  | "richText";

type BlueprintField = {
  key: string;
  label: string;
  type: BlueprintFieldType;
  required?: boolean;
  repeatable?: boolean;
  order?: number;
  options?: Array<{ label: string; value: string }>;
  rules?: Record<string, unknown>;
};

type BlueprintSection = {
  id: string;
  title: string;
  order?: number;
  fields: BlueprintField[];
};

export type TaskWorkflowTemplateKind = "TASK_TEMPLATE" | "CARE_PATHWAY";

export type TaskWorkflowTemplateSchemaSnapshot = {
  sections: BlueprintSection[];
};

export type TaskWorkflowValidation = {
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

const workflowBlueprints: Record<
  TaskWorkflowTemplateKind,
  TaskWorkflowTemplateSchemaSnapshot
> = {
  TASK_TEMPLATE: {
    sections: [
      {
        id: "definition",
        title: "Task Definition",
        order: 1,
        fields: [
          {
            key: "taskKind",
            label: "Task kind",
            type: "text",
            required: true,
          },
          {
            key: "category",
            label: "Category",
            type: "text",
            required: true,
          },
          {
            key: "name",
            label: "Name",
            type: "text",
            required: true,
          },
          {
            key: "description",
            label: "Description",
            type: "richText",
          },
        ],
      },
      {
        id: "assignment",
        title: "Assignment",
        order: 2,
        fields: [
          {
            key: "audience",
            label: "Audience",
            type: "text",
            required: true,
          },
          {
            key: "defaultAssigneeRole",
            label: "Default assignee role",
            type: "text",
          },
          {
            key: "syncWithCalendar",
            label: "Sync with calendar",
            type: "boolean",
          },
        ],
      },
      {
        id: "timing",
        title: "Timing",
        order: 3,
        fields: [
          {
            key: "dueOffsetMinutes",
            label: "Due offset minutes",
            type: "number",
            required: true,
          },
          {
            key: "defaultReminderOffsetMinutes",
            label: "Default reminder offset minutes",
            type: "number",
          },
          {
            key: "recurrence",
            label: "Recurrence",
            type: "text",
          },
        ],
      },
    ],
  },
  CARE_PATHWAY: {
    sections: [
      {
        id: "admission",
        title: "Admission",
        order: 1,
        fields: [
          {
            key: "admissionOffsetMinutes",
            label: "Admission offset minutes",
            type: "number",
            required: true,
          },
          {
            key: "anchor",
            label: "Anchor",
            type: "select",
            options: [
              { label: "Admission", value: "ADMISSION" },
              { label: "Stay", value: "STAY" },
              { label: "Discharge", value: "DISCHARGE" },
            ],
            rules: { allowCustom: false },
          },
        ],
      },
      {
        id: "schedule",
        title: "Schedule",
        order: 2,
        fields: [
          {
            key: "taskBlocks",
            label: "Task blocks",
            type: "repeater",
            required: true,
            repeatable: true,
            rules: {
              columns: [
                "dayOffset",
                "timeOfDay",
                "taskKind",
                "category",
                "name",
                "audience",
              ],
            },
          },
        ],
      },
      {
        id: "discharge",
        title: "Discharge",
        order: 3,
        fields: [
          {
            key: "dischargeOffsetMinutes",
            label: "Discharge offset minutes",
            type: "number",
          },
          {
            key: "followUpTaskName",
            label: "Follow-up task name",
            type: "text",
          },
          {
            key: "signOffRequired",
            label: "Sign-off required",
            type: "boolean",
          },
        ],
      },
    ],
  },
};

const kindToRequiredSectionIds: Record<TaskWorkflowTemplateKind, string[]> = {
  TASK_TEMPLATE: ["definition", "assignment", "timing"],
  CARE_PATHWAY: ["admission", "schedule", "discharge"],
};

const isWorkflowKind = (kind: TemplateKind): kind is TaskWorkflowTemplateKind =>
  kind === "TASK_TEMPLATE" || kind === "CARE_PATHWAY";

const getSections = (snapshot: unknown): SnapshotSection[] => {
  if (!snapshot || typeof snapshot !== "object" || !("sections" in snapshot)) {
    return [];
  }

  const sections = (snapshot as { sections?: unknown }).sections;
  return Array.isArray(sections) ? (sections as SnapshotSection[]) : [];
};

const validateField = (
  kind: TaskWorkflowTemplateKind,
  sectionId: string,
  field: BlueprintField,
  snapshotField: SnapshotField | undefined,
) => {
  const path = `${kind}.${sectionId}.${field.key}`;
  if (!snapshotField) {
    return field.required ? [path] : [];
  }

  return [
    ...validateFieldType(path, field, snapshotField),
    ...validateFieldRepeatable(path, field, snapshotField),
    ...validateFieldOptions(path, field, snapshotField),
    ...validateFieldRules(path, field, snapshotField),
  ];
};

const validateFieldType = (
  path: string,
  field: BlueprintField,
  snapshotField: SnapshotField,
) => {
  if (snapshotField.type === field.type) {
    return [];
  }

  return [`${path}.type`];
};

const validateFieldRepeatable = (
  path: string,
  field: BlueprintField,
  snapshotField: SnapshotField,
) =>
  field.repeatable !== undefined &&
  snapshotField.repeatable !== field.repeatable
    ? [`${path}.repeatable`]
    : [];

const validateFieldOptions = (
  path: string,
  field: BlueprintField,
  snapshotField: SnapshotField,
) => {
  if (!field.options) return [];

  const snapshotOptions = snapshotField.options ?? [];
  const same =
    snapshotOptions.length === field.options.length &&
    field.options.every((option, index) => {
      const snapshotOption = snapshotOptions[index];
      return (
        snapshotOption?.label === option.label &&
        snapshotOption?.value === option.value
      );
    });

  return same ? [] : [`${path}.options`];
};

const validateFieldRules = (
  path: string,
  field: BlueprintField,
  snapshotField: SnapshotField,
) => {
  if (!field.rules) return [];

  const snapshotRules = snapshotField.rules;
  if (!snapshotRules || typeof snapshotRules !== "object") {
    return [`${path}.rules`];
  }

  const same = Object.entries(field.rules).every(([key, value]) => {
    const snapshotValue = Object.entries(snapshotRules).find(
      ([snapshotKey]) => snapshotKey === key,
    )?.[1];
    return JSON.stringify(snapshotValue) === JSON.stringify(value);
  });

  return same ? [] : [`${path}.rules`];
};

export const buildTaskWorkflowTemplateSchemaSnapshot = (
  kind: TaskWorkflowTemplateKind,
): TaskWorkflowTemplateSchemaSnapshot => ({
  sections: workflowBlueprints[kind].sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => ({ ...field })),
  })),
});

export const validateTaskWorkflowTemplateBlueprint = (
  kind: TemplateKind,
  snapshot: unknown,
): TaskWorkflowValidation => {
  if (!isWorkflowKind(kind)) {
    return {
      requiredSectionIds: [],
      missingSectionIds: [],
      missingFieldPaths: [],
      invalidFieldPaths: [],
    };
  }

  const sections = getSections(snapshot);
  const requiredSectionIds = kindToRequiredSectionIds[kind];
  const presentSectionIds = new Set(
    sections.map((section) => section.id?.trim()).filter(Boolean) as string[],
  );
  const missingSectionIds = requiredSectionIds.filter(
    (sectionId) => !presentSectionIds.has(sectionId),
  );

  const missingFieldPaths: string[] = [];
  const invalidFieldPaths: string[] = [];

  for (const section of workflowBlueprints[kind].sections) {
    const snapshotSection = sections.find(
      (candidate) => candidate.id?.trim() === section.id,
    );
    const snapshotFields = snapshotSection?.fields ?? [];

    for (const field of section.fields) {
      const snapshotField = snapshotFields.find(
        (candidate) => candidate.key?.trim() === field.key,
      );
      const issues = validateField(kind, section.id, field, snapshotField);
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
