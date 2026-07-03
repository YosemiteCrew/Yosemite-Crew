import type { TemplateSchemaSnapshot } from "@yosemite-crew/types";
import {
  buildClinicalTemplateSchemaSnapshot,
  buildDefaultSoapNoteSchemaSnapshot,
} from "src/services/clinical-template-blueprints";
import { buildTaskWorkflowTemplateSchemaSnapshot } from "src/services/task-workflow-blueprints";

export type DefaultLibraryTemplateSeed = {
  id: string;
  kind:
    | "SOAP_NOTE"
    | "PRESCRIPTION"
    | "DISCHARGE_SUMMARY"
    | "VITAL_RECORD"
    | "FORM"
    | "TASK_TEMPLATE"
    | "CARE_PATHWAY";
  name: string;
  description: string;
  schemaSnapshot: TemplateSchemaSnapshot;
};

const defaultSeedRules = {
  appliesTo: {
    defaultForKind: true,
  },
} as const;

// Generic intake/consent fallback used when the resolver requests FORM or CONSENT
// (CONSENT normalises to the FORM storage kind) and no org/user template is linked.
const DEFAULT_FORM_SCHEMA: TemplateSchemaSnapshot = {
  sections: [
    {
      id: "details",
      title: "Details",
      order: 1,
      fields: [
        {
          key: "patientName",
          label: "Patient name",
          type: "text",
          required: true,
          order: 1,
        },
        { key: "notes", label: "Notes", type: "richText", order: 2 },
      ],
    },
    {
      id: "acknowledgement",
      title: "Acknowledgement",
      order: 2,
      fields: [
        {
          key: "acknowledged",
          label: "Acknowledged",
          type: "boolean",
          required: true,
          order: 1,
        },
        { key: "signature", label: "Signature", type: "signature", order: 2 },
      ],
    },
  ],
};

export const DEFAULT_LIBRARY_TEMPLATE_SEEDS: Array<
  DefaultLibraryTemplateSeed & {
    ownership: "YC_LIBRARY";
    scope: "ORGANISATION";
    rules: typeof defaultSeedRules;
  }
> = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    ownership: "YC_LIBRARY",
    kind: "SOAP_NOTE",
    name: "Default SOAP note",
    description: "Fallback SOAP note template used by template resolution.",
    scope: "ORGANISATION",
    rules: defaultSeedRules,
    schemaSnapshot: buildDefaultSoapNoteSchemaSnapshot(),
  },
  {
    id: "11111111-1111-4111-8111-111111111112",
    ownership: "YC_LIBRARY",
    kind: "PRESCRIPTION",
    name: "Default prescription",
    description: "Fallback prescription template used by template resolution.",
    scope: "ORGANISATION",
    rules: defaultSeedRules,
    schemaSnapshot: buildClinicalTemplateSchemaSnapshot("PRESCRIPTION"),
  },
  {
    id: "11111111-1111-4111-8111-111111111113",
    ownership: "YC_LIBRARY",
    kind: "DISCHARGE_SUMMARY",
    name: "Default discharge summary",
    description:
      "Fallback discharge summary template used by template resolution.",
    scope: "ORGANISATION",
    rules: defaultSeedRules,
    schemaSnapshot: buildClinicalTemplateSchemaSnapshot("DISCHARGE_SUMMARY"),
  },
  {
    id: "11111111-1111-4111-8111-111111111114",
    ownership: "YC_LIBRARY",
    kind: "VITAL_RECORD",
    name: "Default vital record",
    description: "Fallback vital record template used by template resolution.",
    scope: "ORGANISATION",
    rules: defaultSeedRules,
    schemaSnapshot: buildClinicalTemplateSchemaSnapshot(
      "VITAL_RECORD",
    ) as unknown as TemplateSchemaSnapshot,
  },
  {
    id: "11111111-1111-4111-8111-111111111115",
    ownership: "YC_LIBRARY",
    kind: "FORM",
    name: "Default form",
    description:
      "Fallback form/consent template used by template resolution (FORM + CONSENT).",
    scope: "ORGANISATION",
    rules: defaultSeedRules,
    schemaSnapshot: DEFAULT_FORM_SCHEMA,
  },
  {
    id: "11111111-1111-4111-8111-111111111116",
    ownership: "YC_LIBRARY",
    kind: "TASK_TEMPLATE",
    name: "Default task template",
    description:
      "Fallback task template used by template resolution (TASK_ASSIGNMENT).",
    scope: "ORGANISATION",
    rules: defaultSeedRules,
    schemaSnapshot: buildTaskWorkflowTemplateSchemaSnapshot(
      "TASK_TEMPLATE",
    ) as unknown as TemplateSchemaSnapshot,
  },
  {
    id: "11111111-1111-4111-8111-111111111117",
    ownership: "YC_LIBRARY",
    kind: "CARE_PATHWAY",
    name: "Default inpatient schedule",
    description:
      "Fallback care-pathway template used by template resolution (INPATIENT_SCHEDULE).",
    scope: "ORGANISATION",
    rules: defaultSeedRules,
    schemaSnapshot: buildTaskWorkflowTemplateSchemaSnapshot(
      "CARE_PATHWAY",
    ) as unknown as TemplateSchemaSnapshot,
  },
];
