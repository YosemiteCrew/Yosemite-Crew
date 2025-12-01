export type FieldType =
  | "input"
  | "textarea"
  | "number"
  | "dropdown"
  | "radio"
  | "checkbox"
  | "boolean"
  | "date"
  | "signature"
  | "group";

export interface FieldOption {
  label: string;
  value: string;
}

export interface BaseField {
  id: string;            // FE-generated stable ID
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  order?: number;
  group?: string;        // "companion_details", "parent_details"
  meta?: Record<string, any>;
}

export interface InputField extends BaseField {
  type: "input" | "textarea" | "number";
}

export interface ChoiceField extends BaseField {
  type: "dropdown" | "radio" | "checkbox";
  options: FieldOption[];
  multiple?: boolean;   // for checkbox groups
}

export interface BooleanField extends BaseField {
  type: "boolean";
}

export interface DateField extends BaseField {
  type: "date";
}

export interface SignatureField extends BaseField {
  type: "signature";
}

export interface GroupField extends BaseField {
  type: "group";
  fields: FormField[];
}

export type FormField =
  | InputField
  | ChoiceField
  | BooleanField
  | DateField
  | SignatureField
  | GroupField;

export interface FormSchema {
  fields: FormField[];
}

export interface Form {
  _id: string;
  orgId: string;

  name: string;
  category: string;
  description?: string;
  visibilityType: "Internal" | "External";

  speciesFilter?: string[];

  status: "draft" | "published" | "archived";

  schema: FormField[];       // entire FE schema for easy editing

  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormVersion {
  _id: string;
  formId: string;
  version: number;
  schemaSnapshot: FormField[];
  fieldsSnapshot: any[];
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormSubmission {
  _id: string;
  formId: string;
  formVersion: number;
  appointmentId?: string;
  companionId?: string;
  parentId?: string;
  submittedBy?: string;
  answers: Record<string, any>;
  submittedAt: Date;
}