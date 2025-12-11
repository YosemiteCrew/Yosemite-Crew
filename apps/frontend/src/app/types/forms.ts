import type {
  FieldOption,
  FieldType,
  Form as BackendForm,
  FormField as BackendFormField,
} from "@yosemite-crew/types";

const formsCategories = [
  "Consent form",
  "SOAP-Subjective",
  "SOAP-Objective",
  "SOAP-Assessment",
  "SOAP-Plan",
  "Discharge",
  "Custom",
] as const;

export type FormsCategory = (typeof formsCategories)[number];
export const FormsCategoryOptions: FormsCategory[] = [...formsCategories];

const formsUsageOptions = ["Internal", "External", "Internal & External"] as const;

export type FormsUsage = (typeof formsUsageOptions)[number];
export const FormsUsageOptions: FormsUsage[] = [...formsUsageOptions];

const formsStatuses = ["Published", "Draft", "Archived"] as const;

export type FormsStatus = (typeof formsStatuses)[number];
export const FormsStatusFilters: Array<FormsStatus | "All"> = [
  "All",
  ...formsStatuses,
];

export type FormFieldType = FieldType;
export type FormField = BackendFormField & { defaultValue?: any };

export type FormsProps = {
  _id?: string;
  orgId?: string;
  name: string;
  description?: string;
  services?: string[];
  species?: string[];
  category: FormsCategory;
  usage: FormsUsage;
  updatedBy: string;
  lastUpdated: string;
  status?: FormsStatus;
  schema: FormField[];
};

const makeOption = (label: string, value?: string): FieldOption => ({
  label,
  value: value ?? label,
});

export const medicationRouteOptions = ["PO", "IM", "IV", "SC"].map((label) =>
  makeOption(label)
);

export const buildMedicationFields = (
  prefix: string,
  separator: "_" | "-" = "_"
): FormField[] => {
  const join = (key: string) => `${prefix}${separator}${key}`;
  return [
    {
      id: join("name"),
      type: "input",
      label: "Name",
      placeholder: "Enter medicine name",
    },
    {
      id: join("dosage"),
      type: "input",
      label: "Dosage",
      placeholder: "Enter dosage",
    },
    {
      id: join("route"),
      type: "dropdown",
      label: "Route",
      options: medicationRouteOptions,
    },
    {
      id: join("frequency"),
      type: "input",
      label: "Frequency",
      placeholder: "Enter frequency",
    },
    {
      id: join("duration"),
      type: "input",
      label: "Duration",
      placeholder: "Enter duration",
    },
    {
      id: join("price"),
      type: "number",
      label: "Price",
      placeholder: "",
    },
    {
      id: join("remark"),
      type: "textarea",
      label: "Remark",
      placeholder: "Add remark",
    },
  ];
};

const buildMedicationGroup = (suffix: string, label: string): FormField => ({
  id: `medication_${suffix}`,
  type: "group",
  label,
  fields: buildMedicationFields(`medication_${suffix}`),
});

export const CategoryTemplates: Record<FormsCategory, FormField[]> = {
  Custom: [],
  "Consent form": [
    {
      id: "pet_name",
      type: "input",
      label: "Pet name",
      placeholder: "Enter pet name",
      required: true,
    },
    {
      id: "owner_name",
      type: "input",
      label: "Owner name",
      placeholder: "Enter owner name",
      required: true,
    },
    {
      id: "procedure",
      type: "textarea",
      label: "Procedure / treatment",
      placeholder: "Describe the procedure and purpose",
      required: true,
    },
    {
      id: "risks",
      type: "textarea",
      label: "Risks discussed",
      placeholder: "List key risks that were explained to the owner",
    },
    {
      id: "consent_ack",
      type: "checkbox",
      label: "Owner agrees to proceed",
      options: [makeOption("I have read and understood the above")],
      multiple: true,
    },
    {
      id: "consent_signature",
      type: "signature",
      label: "Owner signature",
      required: true,
    },
  ],
  "SOAP-Subjective": [
    {
      id: "subjective_history",
      type: "textarea",
      label: "Subjective (history)",
      placeholder: "Describe presenting concerns and history",
      required: true,
    },
  ],
  "SOAP-Objective": [
    {
      id: "general_behavior",
      type: "textarea",
      label: "General behavior",
      placeholder: "General behavior notes",
    },
    {
      id: "vitals",
      type: "group",
      label: "Vitals",
      fields: [
        {
          id: "temperature",
          type: "number",
          label: "Temperature",
          placeholder: "",
        },
        {
          id: "pulse",
          type: "input",
          label: "Pulse",
          placeholder: "Enter pulse",
        },
        {
          id: "respiration",
          type: "number",
          label: "Respiration",
          placeholder: "",
        },
        {
          id: "mucous_membrane_color",
          type: "input",
          label: "Mucous membrane color",
          placeholder: "Enter color",
        },
        {
          id: "blood_pressure",
          type: "input",
          label: "Blood pressure",
          placeholder: "Enter blood pressure",
        },
        {
          id: "body_weight",
          type: "input",
          label: "Body weight",
          placeholder: "Enter weight",
        },
        {
          id: "hydration_status",
          type: "input",
          label: "Hydration status",
          placeholder: "Describe hydration",
        },
        {
          id: "behavior_secondary",
          type: "input",
          label: "General behavior",
          placeholder: "Enter behavior",
        },
      ],
    },
    {
      id: "musculoskeletal_exam",
      type: "textarea",
      label: "Musculoskeletal Exam",
      placeholder: "Document findings",
    },
    {
      id: "neuro",
      type: "textarea",
      label: "Neuro",
      placeholder: "Document findings",
    },
    {
      id: "pain_score",
      type: "textarea",
      label: "Pain Score",
      placeholder: "Enter pain score details",
    },
  ],
  "SOAP-Assessment": [
    {
      id: "tentative_diagnosis",
      type: "textarea",
      label: "Tentative diagnosis",
      placeholder: "Enter tentative diagnosis",
    },
    {
      id: "differential_diagnosis",
      type: "textarea",
      label: "Differential diagnosis",
      placeholder: "List differential diagnoses",
    },
    {
      id: "prognosis",
      type: "textarea",
      label: "Prognosis",
      placeholder: "Enter prognosis",
    },
  ],
  "SOAP-Plan": [
    {
      id: "treatment_plan",
      type: "group",
      label: "Treatment / Plan",
      fields: [
        buildMedicationGroup("1", "Medication 1"),
        buildMedicationGroup("2", "Medication 2"),
      ],
    },
    {
      id: "additional_notes",
      type: "textarea",
      label: "Additional notes",
      placeholder: "Add observations and owner instructions",
    },
    {
      id: "important_notes",
      type: "textarea",
      label: "Important notes",
      placeholder: "Highlight critical follow-up instructions",
    },
    {
      id: "signature",
      type: "signature",
      label: "Signature",
    },
  ],
  Discharge: [
    {
      id: "discharge_summary",
      type: "textarea",
      label: "Discharge summary",
      placeholder: "Summarize visit, findings and treatments provided.",
    },
    {
      id: "home_care",
      type: "textarea",
      label: "Home care instructions",
      placeholder: "Explain wound care, diet, activity restriction.",
    },
    {
      id: "medications",
      type: "textarea",
      label: "Medications",
      placeholder: "List medications, dosage, route, and schedule.",
    },
    {
      id: "follow_up",
      type: "date",
      label: "Follow-up date",
      placeholder: "Select next visit date",
    },
    {
      id: "discharge_signature",
      type: "signature",
      label: "Signature",
    },
  ],
};

export type BackendFormStatus = BackendForm["status"];
