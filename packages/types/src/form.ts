import type {
  Extension,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireItemType,
  QuestionnaireStatus,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
} from "@yosemite-crew/fhirtypes";

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
  | "group"
  | "service-group";

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

export interface ServiceGroupField extends BaseField {
  type: "service-group";
  services?: string[];
}

export type FormField =
  | InputField
  | ChoiceField
  | BooleanField
  | DateField
  | SignatureField
  | GroupField
  | ServiceGroupField;

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
  serviceId?: string | string[];
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

const FORM_CATEGORY_SYSTEM_URL =
  "https://yosemitecrew.com/fhir/CodeSystem/form-category";
const FORM_ORG_IDENTIFIER_SYSTEM_URL =
  "https://yosemitecrew.com/fhir/NamingSystem/form-organisation";
const FORM_VISIBILITY_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-visibility";
const FORM_SERVICE_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-service";
const FORM_CATEGORY_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-category";
const FORM_SPECIES_FILTER_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-species-filter";
const FORM_CREATED_BY_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-created-by";
const FORM_UPDATED_BY_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-updated-by";
const FORM_CREATED_AT_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-created-at";
const FORM_UPDATED_AT_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-updated-at";

const FIELD_TYPE_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-field-type";
const FIELD_PLACEHOLDER_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-field-placeholder";
const FIELD_ORDER_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-field-order";
const FIELD_GROUP_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-field-group";
const FIELD_META_EXTENSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-field-meta";
const FIELD_OPTION_SYSTEM_URL =
  "https://yosemitecrew.com/fhir/CodeSystem/form-field-option";

const FORM_RESPONSE_FORM_VERSION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-response-version";
const FORM_RESPONSE_APPOINTMENT_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-response-appointment";
const FORM_RESPONSE_COMPANION_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-response-companion";
const FORM_RESPONSE_PARENT_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-response-parent";
const FORM_RESPONSE_SUBMITTED_BY_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-response-submitted-by";
const FORM_RESPONSE_SUBMITTED_AT_URL =
  "https://yosemitecrew.com/fhir/StructureDefinition/form-response-submitted-at";


const FORM_TO_FHIR_STATUS: Record<Form["status"], QuestionnaireStatus> = {
  draft: "draft",
  published: "active",
  archived: "retired",
};

const FHIR_TO_FORM_STATUS: Record<QuestionnaireStatus, Form["status"]> = {
  draft: "draft",
  active: "published",
  retired: "archived",
  unknown: "draft",
};

const stripBase64Prefix = (data?: string): string | undefined => {
  if (!data) return undefined;
  return data.includes(",") ? data.split(",")[1] : data;
};

const toIsoDate = (value?: Date): string | undefined => {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

const parseDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const toFHIRDateOnly = (val: unknown): string | undefined => {
  if (!val) return undefined;
  const d = val instanceof Date ? val : new Date(val as string);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().split("T")[0];
};


const buildFieldExtensions = (field: BaseField): Extension[] | undefined => {
  const ex: Extension[] = [
    { url: FIELD_TYPE_EXTENSION_URL, valueString: field.type },
  ];

  if (field.placeholder)
    ex.push({ url: FIELD_PLACEHOLDER_EXTENSION_URL, valueString: field.placeholder });

  if (typeof field.order === "number")
    ex.push({ url: FIELD_ORDER_EXTENSION_URL, valueInteger: field.order });

  if (field.group)
    ex.push({ url: FIELD_GROUP_EXTENSION_URL, valueString: field.group });

  const metaPayload =
    field.type === "service-group" && (field as any).services?.length
      ? { ...(field.meta ?? {}), services: (field as any).services }
      : field.meta;

  if (metaPayload && Object.keys(metaPayload).length)
    ex.push({
      url: FIELD_META_EXTENSION_URL,
      valueString: JSON.stringify(metaPayload),
    });

  return ex.length ? ex : undefined;
};

const toQuestionnaireItemType = (field: FormField): QuestionnaireItemType => {
  switch (field.type) {
    case "input": return "string";
    case "textarea": return "text";
    case "number": return "decimal";     // FIX APPLIED
    case "dropdown":
    case "radio":
    case "checkbox": return "choice";
    case "boolean": return "boolean";
    case "date": return "date";
    case "signature": return "attachment";
    case "group": return "group";
    case "service-group": return "string";
    default: return "string";
  }
};

const toAnswerOptions = (field: ChoiceField): QuestionnaireItem["answerOption"] =>
  field.options.map((o) => ({
    valueCoding: {
      system: FIELD_OPTION_SYSTEM_URL,
      code: o.value,
      display: o.label,
    },
  }));

const formFieldToQuestionnaireItem = (field: FormField): QuestionnaireItem => {
  const item: QuestionnaireItem = {
    linkId: field.id,
    text: field.label,
    type: toQuestionnaireItemType(field),
    required: field.required,
    extension: buildFieldExtensions(field),
  };

  if (field.type === "group") {
    item.item = field.fields.map(formFieldToQuestionnaireItem);
    return item;
  }

  if (field.type === "dropdown" || field.type === "radio" || field.type === "checkbox") {
    item.answerOption = toAnswerOptions(field as ChoiceField);
    item.repeats = field.type === "checkbox" || Boolean((field as ChoiceField).multiple);
  }

  if (field.type === "radio") {
    item.repeats = false;   // FIX APPLIED
  }

  return item;
};

const buildFormExtensions = (form: Form): Extension[] | undefined => {
  const ex: Extension[] = [];

  if (form.visibilityType)
    ex.push({ url: FORM_VISIBILITY_URL, valueString: form.visibilityType });

  if (form.serviceId) {
    const ids = Array.isArray(form.serviceId) ? form.serviceId : [form.serviceId];
    ids.forEach((sid) =>
      ex.push({ url: FORM_SERVICE_URL, valueString: sid })
    );
  }

  if (form.category)
    ex.push({ url: FORM_CATEGORY_EXTENSION_URL, valueString: form.category });

  if (form.speciesFilter)
    form.speciesFilter.forEach((sf) =>
      ex.push({ url: FORM_SPECIES_FILTER_URL, valueString: sf })
    );

  if (form.createdBy)
    ex.push({ url: FORM_CREATED_BY_URL, valueString: form.createdBy });

  if (form.updatedBy)
    ex.push({ url: FORM_UPDATED_BY_URL, valueString: form.updatedBy });

  const createdAt = toIsoDate(form.createdAt);
  if (createdAt)
    ex.push({ url: FORM_CREATED_AT_URL, valueDateTime: createdAt });

  const updatedAt = toIsoDate(form.updatedAt);
  if (updatedAt)
    ex.push({ url: FORM_UPDATED_AT_URL, valueDateTime: updatedAt });

  return ex.length ? ex : undefined;
};

export const toFHIRQuestionnaire = (form: Form): Questionnaire => {
  const lastUpdated = toIsoDate(form.updatedAt);

  return {
    resourceType: "Questionnaire",
    id: form._id,
    status: FORM_TO_FHIR_STATUS[form.status] ?? "draft",
    title: form.name,
    description: form.description,
    identifier: [
      { system: FORM_ORG_IDENTIFIER_SYSTEM_URL, value: form.orgId },
    ],
    code: form.category
      ? [
          {
            system: FORM_CATEGORY_SYSTEM_URL,
            code: form.category,
            display: form.category,
          },
        ]
      : undefined,
    extension: buildFormExtensions(form),
    meta: lastUpdated ? { lastUpdated } : undefined,
    item: form.schema.map(formFieldToQuestionnaireItem),
  };
};

const getFieldExtension = (
  ex: Extension[] | undefined,
  url: string
) => ex?.find((e) => e.url === url);

const getFormExtensionValue = (
  ex: Extension[] | undefined,
  url: string
): string | undefined => ex?.find((e) => e.url === url)?.valueString;

const getFormExtensionValues = (
  ex: Extension[] | undefined,
  url: string
): string[] =>
  ex?.filter((e) => e.url === url)
    .map((e) => e.valueString)
    .filter((x): x is string => Boolean(x)) ?? [];

const getFormDateExtensionValue = (
  ex: Extension[] | undefined,
  url: string
): string | undefined => ex?.find((e) => e.url === url)?.valueDateTime;

/* ============================================================================
 * Parse Field Type (FHIR → Internal)
 * ============================================================================ */

const parseFieldType = (item: QuestionnaireItem): FieldType => {
  const ext = getFieldExtension(item.extension, FIELD_TYPE_EXTENSION_URL)
    ?.valueString as FieldType | undefined;

  if (ext) return ext;

  switch (item.type) {
    case "text": return "textarea";
    case "decimal":
    case "integer": return "number";
    case "choice":
      return item.repeats ? "checkbox" : "dropdown";
    case "boolean": return "boolean";
    case "date": return "date";
    case "attachment": return "signature";
    case "group": return "group";
    default: return "input";
  }
};

const parseFieldMeta = (raw?: string): Record<string, any> | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const answerOptionsToFieldOptions = (
  answerOption: QuestionnaireItem["answerOption"]
): FieldOption[] =>
  answerOption?.map((o) => {
    if (o.valueCoding)
      return {
        label: o.valueCoding.display ?? o.valueCoding.code ?? "",
        value: o.valueCoding.code ?? o.valueCoding.display ?? "",
      };
    if (o.valueString)
      return { label: o.valueString, value: o.valueString };
    return undefined;
  }).filter((x): x is FieldOption => Boolean(x)) ?? [];

const questionnaireItemToFormField = (item: QuestionnaireItem): FormField => {
  const type = parseFieldType(item);

  const base: BaseField = {
    id: item.linkId,
    type,
    label: item.text || item.linkId,
    required: item.required,
    placeholder: getFieldExtension(item.extension, FIELD_PLACEHOLDER_EXTENSION_URL)?.valueString,
    order: getFieldExtension(item.extension, FIELD_ORDER_EXTENSION_URL)?.valueInteger,
    group: getFieldExtension(item.extension, FIELD_GROUP_EXTENSION_URL)?.valueString,
    meta: parseFieldMeta(
      getFieldExtension(item.extension, FIELD_META_EXTENSION_URL)?.valueString
    ),
  };

  if (type === "group") {
    return {
      ...base,
      type: "group",
      fields: (item.item ?? []).map(questionnaireItemToFormField),
    };
  }

  if (type === "service-group") {
    const services = Array.isArray((base.meta as any)?.services)
      ? ((base.meta as any).services as string[])
      : undefined;
    return {
      ...(base as any),
      type: "service-group",
      services,
    };
  }

  if (type === "dropdown" || type === "radio" || type === "checkbox") {
    return {
      ...base,
      type,
      options: answerOptionsToFieldOptions(item.answerOption),
      multiple: item.repeats,
    };
  }

  return { ...base, type };
};

export const fromFHIRQuestionnaire = (q: Questionnaire): Form => {
  const ex = q.extension;

  const serviceIds = getFormExtensionValues(ex, FORM_SERVICE_URL);
  const speciesFilter = getFormExtensionValues(ex, FORM_SPECIES_FILTER_URL);

  return {
    _id: q.id ?? "",
    orgId:
      q.identifier?.find((i) => i.system === FORM_ORG_IDENTIFIER_SYSTEM_URL)?.value ||
      "",
    name: q.title || q.name || "",
    category:
      getFormExtensionValue(ex, FORM_CATEGORY_EXTENSION_URL) ||
      q.code?.[0]?.code ||
      "",
    description: q.description,
    visibilityType:
      (getFormExtensionValue(ex, FORM_VISIBILITY_URL) as Form["visibilityType"]) ||
      "Internal",
    serviceId: serviceIds.length > 1 ? serviceIds : serviceIds[0],
    speciesFilter: speciesFilter.length ? speciesFilter : undefined,
    status: FHIR_TO_FORM_STATUS[q.status] || "draft",
    schema: (q.item ?? []).map(questionnaireItemToFormField),
    createdBy: getFormExtensionValue(ex, FORM_CREATED_BY_URL) || "",
    updatedBy: getFormExtensionValue(ex, FORM_UPDATED_BY_URL) || "",
    createdAt:
      parseDate(getFormDateExtensionValue(ex, FORM_CREATED_AT_URL)) || new Date(),
    updatedAt:
      parseDate(
        getFormDateExtensionValue(ex, FORM_UPDATED_AT_URL) ||
          q.meta?.lastUpdated
      ) || new Date(),
  };
};

const findOptionLabel = (
  field: ChoiceField | undefined,
  value: string
): string | undefined =>
  field?.options.find((o) => o.value === value)?.label;

const buildAttachmentAnswer = (value: any): QuestionnaireResponseItemAnswer => ({
  valueAttachment: {
    url: value?.url,
    title: value?.title,
    contentType: value?.contentType,
    data: stripBase64Prefix(value?.data),   // FIX APPLIED
  },
});

const buildAnswers = (
  field: FormField | undefined,
  value: any
): QuestionnaireResponseItemAnswer[] | undefined => {
  if (value === undefined || value === null) return undefined;

  const vals = Array.isArray(value) ? value : [value];
  const answers: QuestionnaireResponseItemAnswer[] = [];

  vals.forEach((v) => {
    switch (field?.type) {
      case "boolean":
        answers.push({ valueBoolean: Boolean(v) });
        break;
      case "date": {
        const dateVal = toFHIRDateOnly(v);
        if (dateVal) answers.push({ valueDate: dateVal });
        break;
      }
      case "number": {
        const num = Number(v);
        if (!Number.isNaN(num)) answers.push({ valueDecimal: num });
        else answers.push({ valueString: String(v) });
        break;
      }
      case "dropdown":
      case "radio":
      case "checkbox": {
        const code = String(v);
        const display = findOptionLabel(field as ChoiceField, code);
        answers.push({
          valueCoding: {
            system: FIELD_OPTION_SYSTEM_URL,
            code,
            display,
          },
        });
        break;
      }
      case "signature":
        answers.push(buildAttachmentAnswer(v));
        break;
      default:
        answers.push({
          valueString: typeof v === "string" ? v : JSON.stringify(v),
        });
    }
  });

  return answers.length ? answers : undefined;
};

const formFieldsToResponseItems = (
  fields: FormField[],
  answers: Record<string, any>
): QuestionnaireResponseItem[] =>
  fields.map((f) => {
    if (f.type === "group") {
      const nested = formFieldsToResponseItems(f.fields, answers);
      return {
        linkId: f.id,
        text: f.label,
        item: nested.length ? nested : undefined,
      };
    }

    const ans = buildAnswers(f, answers[f.id]);

    return {
      linkId: f.id,
      text: f.label,
      answer: ans,
    };
  });

const formAnswerRecordToItems = (
  answers: Record<string, any>
): QuestionnaireResponseItem[] =>
  Object.entries(answers).map(([linkId, value]) => ({
    linkId,
    answer: buildAnswers(undefined, value),
  }));

export const toFHIRQuestionnaireResponse = (
  submission: FormSubmission,
  schema?: FormField[]
): QuestionnaireResponse => {
  const extensions: Extension[] = [];

  if (submission.formVersion != null)
    extensions.push({
      url: FORM_RESPONSE_FORM_VERSION_URL,
      valueInteger: submission.formVersion,
    });

  if (submission.appointmentId)
    extensions.push({
      url: FORM_RESPONSE_APPOINTMENT_URL,
      valueString: submission.appointmentId,
    });

  if (submission.companionId)
    extensions.push({
      url: FORM_RESPONSE_COMPANION_URL,
      valueString: submission.companionId,
    });

  if (submission.parentId)
    extensions.push({
      url: FORM_RESPONSE_PARENT_URL,
      valueString: submission.parentId,
    });

  if (submission.submittedBy)
    extensions.push({
      url: FORM_RESPONSE_SUBMITTED_BY_URL,
      valueString: submission.submittedBy,
    });

  const submittedAt = toIsoDate(submission.submittedAt);
  if (submittedAt)
    extensions.push({
      url: FORM_RESPONSE_SUBMITTED_AT_URL,
      valueDateTime: submittedAt,
    });

  const questionnaireRef = submission.formId
    ? `Questionnaire/${submission.formId}`
    : undefined;

  const items = schema
    ? formFieldsToResponseItems(schema, submission.answers)
    : formAnswerRecordToItems(submission.answers);

  return {
    resourceType: "QuestionnaireResponse",
    id: submission._id,
    questionnaire: questionnaireRef,
    status: "completed",
    authored: submittedAt,
    extension: extensions.length ? extensions : undefined,
    item: items,
  };
};

const parseQuestionnaireId = (ref?: string): string => {
  if (!ref) return "";
  return ref.split("|")[0].split("/").pop() ?? "";
};

const parseQuestionnaireVersion = (ref?: string): number | undefined => {
  if (!ref) return undefined;
  const v = ref.split("|")[1];
  if (!v) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};

const answerToValue = (
  answers: QuestionnaireResponseItemAnswer[],
  field?: FormField
): any => {
  const values = answers
    .map((ans) => {
      if (ans.valueBoolean !== undefined) return ans.valueBoolean;
      if (ans.valueDecimal !== undefined) return ans.valueDecimal;
      if (ans.valueInteger !== undefined) return ans.valueInteger;
      if (ans.valueDate !== undefined) return parseDate(ans.valueDate) ?? ans.valueDate;
      if (ans.valueDateTime !== undefined) return parseDate(ans.valueDateTime) ?? ans.valueDateTime;

      if (ans.valueAttachment !== undefined) {
        return {
          url: ans.valueAttachment.url,
          title: ans.valueAttachment.title,
          contentType: ans.valueAttachment.contentType,
          data: stripBase64Prefix(ans.valueAttachment.data), // FIX APPLIED
        };
      }

      if (ans.valueCoding !== undefined)
        return ans.valueCoding.code ?? ans.valueCoding.display;

      if (ans.valueString !== undefined) return ans.valueString;

      return undefined;
    })
    .filter((x) => x !== undefined);

  if (!values.length) return undefined;

  const isMultiple =
    (field && field.type === "checkbox") ||
    (field && "multiple" in field && Boolean((field as ChoiceField).multiple)) ||
    values.length > 1;

  return isMultiple ? values : values[0];
};

const buildFieldLookup = (fields?: FormField[]): Record<string, FormField> => {
  const map: Record<string, FormField> = {};

  const walk = (items?: FormField[]) => {
    items?.forEach((f) => {
      map[f.id] = f;
      if (f.type === "group") walk(f.fields);
    });
  };

  walk(fields);
  return map;
};

const collectAnswersFromItems = (
  items: QuestionnaireResponseItem[] | undefined,
  lookup: Record<string, FormField>,
  acc: Record<string, any>
) => {
  items?.forEach((it) => {
    if (it.answer?.length) {
      const field = lookup[it.linkId];
      const val = answerToValue(it.answer, field);
      if (val !== undefined) acc[it.linkId] = val;
    }
    if (it.item?.length) collectAnswersFromItems(it.item, lookup, acc);
  });
};

export const fromFHIRQuestionnaireResponse = (
  response: QuestionnaireResponse,
  schema?: FormField[]
): FormSubmission => {
  if (!response || response.resourceType !== "QuestionnaireResponse") {
    throw new Error("Invalid payload. Expected FHIR QuestionnaireResponse.");
  }

  const lookup = buildFieldLookup(schema);
  const answers: Record<string, any> = {};
  collectAnswersFromItems(response.item, lookup, answers);

  const versionExtension = response.extension?.find(
    (ext) => ext.url === FORM_RESPONSE_FORM_VERSION_URL
  )?.valueInteger;

  const versionFromRef = parseQuestionnaireVersion(response.questionnaire);

  const submittedBy =
    response.extension?.find(
      (ext) => ext.url === FORM_RESPONSE_SUBMITTED_BY_URL
    )?.valueString || "";

  const authored =
    response.authored ||
    response.extension?.find(
      (ext) => ext.url === FORM_RESPONSE_SUBMITTED_AT_URL
    )?.valueDateTime;

  return {
    _id: response.id ?? "",
    formId: parseQuestionnaireId(response.questionnaire),
    formVersion: versionExtension ?? versionFromRef ?? 1,
    appointmentId:
      response.extension?.find((ext) => ext.url === FORM_RESPONSE_APPOINTMENT_URL)
        ?.valueString,
    companionId:
      response.extension?.find((ext) => ext.url === FORM_RESPONSE_COMPANION_URL)
        ?.valueString,
    parentId:
      response.extension?.find((ext) => ext.url === FORM_RESPONSE_PARENT_URL)
        ?.valueString,
    submittedBy,
    answers,
    submittedAt: parseDate(authored) || new Date(),
  };
};
