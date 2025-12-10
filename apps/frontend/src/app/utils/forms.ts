import {
  Form,
  FormField,
  FormRequestDTO,
  FormResponseDTO,
  fromFormRequestDTO,
  toFormResponseDTO,
} from "@yosemite-crew/types";
import {
  CategoryTemplates,
  FormsCategory,
  FormsProps,
  FormsStatus,
  FormsUsage,
} from "../types/forms";

const statusToLabelMap: Record<Form["status"], FormsStatus> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const labelToStatusMap: Record<FormsStatus, Form["status"]> = {
  Draft: "draft",
  Published: "published",
  Archived: "archived",
};

const toList = (val?: string | string[]): string[] => {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
};

export const formatDateLabel = (value?: Date | string): string => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
};

export const statusToLabel = (status?: Form["status"]): FormsStatus => {
  if (!status) return "Draft";
  return statusToLabelMap[status] ?? "Draft";
};

export const labelToStatus = (label?: FormsStatus): Form["status"] => {
  if (!label) return "draft";
  return labelToStatusMap[label] ?? "draft";
};

const cloneField = (field: FormField): FormField => {
  if (field.type === "group") {
    return {
      ...field,
      fields: (field.fields ?? []).map(cloneField),
    };
  }
  return { ...field };
};

export const getCategoryTemplate = (
  category: FormsCategory
): FormField[] => (CategoryTemplates[category] ?? []).map(cloneField);

export const questionnaireToForm = (dto: FormResponseDTO): Form => {
  return fromFormRequestDTO(dto);
};

export const mapFormToUI = (form: Form): FormsProps => ({
  _id: form._id,
  orgId: form.orgId,
  name: form.name,
  description: form.description,
  services: toList(form.serviceId),
  species: form.speciesFilter ?? [],
  category: form.category as FormsCategory,
  usage: (() => {
    const visibility = (form.visibilityType as FormsUsage) ?? "Internal";
    if (typeof visibility === "string") {
      const normalized = visibility
        .toLowerCase()
        .replaceAll(/\s|-/g, "");
      if (
        normalized === "internal&external" ||
        normalized === "internal_external" ||
        normalized === "interna_external"
      ) {
        return "Internal & External";
      }
    }
    return visibility;
  })(),
  updatedBy: form.updatedBy || "",
  lastUpdated: formatDateLabel(form.updatedAt ?? form.createdAt),
  status: statusToLabel(form.status),
  schema: (form.schema ?? []).map(cloneField),
});

export const mapQuestionnaireToUI = (
  dto: FormResponseDTO
): FormsProps => mapFormToUI(questionnaireToForm(dto));

type BuildPayloadArgs = {
  form: FormsProps;
  orgId: string;
  userId: string;
  fallbackToTemplate?: boolean;
};

export const buildFHIRPayload = ({
  form,
  orgId,
  userId,
  fallbackToTemplate = true,
}: BuildPayloadArgs): FormRequestDTO => {
  const hasSchema = Boolean(form.schema?.length);
  const templateSchema =
    !hasSchema && fallbackToTemplate ? getCategoryTemplate(form.category) : [];
  const schema = hasSchema ? form.schema : templateSchema;

  const now = new Date();
  const usage = form.usage ?? "Internal";
  const visibilityType = (
    usage === "Internal & External" ? "Internal_External" : usage
  ) as Form["visibilityType"]; // backend supports Internal_External; local types lag

  const normalized: Form = {
    _id: form._id ?? "",
    orgId: orgId,
    name: form.name,
    category: form.category,
    description: form.description,
    visibilityType,
    serviceId: form.services?.length ? form.services : undefined,
    speciesFilter: form.species?.length ? form.species : undefined,
    status: labelToStatus(form.status),
    schema,
    createdBy: (form as any).createdBy || userId,
    updatedBy: userId,
    createdAt: (form as any).createdAt || now,
    updatedAt: now,
  };

  return toFormResponseDTO(normalized);
};
