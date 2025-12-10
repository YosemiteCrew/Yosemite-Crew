export type FormsCategory =
  | "Consent form"
  | "SOAP-Subjective"
  | "SOAP-Objective"
  | "SOAP-Assessment"
  | "SOAP-Plan"
  | "Discharge";

export const FormsCategoryOptions: FormsCategory[] = [
  "Consent form",
  "SOAP-Subjective",
  "SOAP-Objective",
  "SOAP-Assessment",
  "SOAP-Plan",
  "Discharge"
];

export type FormsUsage = "Internal" | "External" | "Internal & External";

export const FormsUsageOptions: FormsUsage[] = [
  "Internal",
  "External",
  "Internal & External",
];

export type FormsStatus = "Published" | "Draft" | "Archived";

export type FormFieldType = "text" | "input" | "dropdown" | "signature";

export interface BaseFormField {
  id: string;
  type: FormFieldType;
  label?: string;
  required?: boolean;
}

export interface TextField extends BaseFormField {
  type: "text";
  value: string;
}
export interface InputField extends BaseFormField {
  type: "input";
  value: string;
}
export interface DropdownField extends BaseFormField {
  type: "dropdown";
  options: string[];
}
export interface SignatureField extends BaseFormField {
  type: "signature";
}
export type FormField =
  | TextField
  | InputField
  | DropdownField
  | SignatureField;

export type GroupFormField = {
  title: string;
  fields: FormField[];
}

export type FormsProps = {
  name: string;
  description?: string;
  services?: string[];
  species?: string[];
  category: FormsCategory;
  usage: FormsUsage;
  updatedBy: string;
  lastUpdated: string;
  status?: FormsStatus;
  fields?: FormField[];
};
