import { Task, TaskKind, TaskLibrary, TaskTemplate } from "@/app/types/task";
import { Option } from "@/app/types/companion";

export type TaskFormErrors = {
  name?: string;
  assignedTo?: string;
  category?: string;
  templateId?: string;
  libraryTaskId?: string;
};

export const validateTaskForm = (formData: Task): TaskFormErrors => {
  const errors: TaskFormErrors = {};
  if (!formData.assignedTo)
    errors.assignedTo = "Please select a companion or staff";
  if (!formData.name) errors.name = "Name is required";
  if (!formData.category) errors.category = "Category is required";
  if (formData.source === "ORG_TEMPLATE" && !formData.templateId) {
    errors.templateId = "Template is required";
  }
  if (formData.source === "YC_LIBRARY" && !formData.libraryTaskId) {
    errors.libraryTaskId = "Library task is required";
  }
  return errors;
};

export const buildTaskTemplate = (formData: Task): TaskTemplate => ({
  _id: "",
  source: "ORG_TEMPLATE",
  category: formData.category,
  name: formData.name,
  description: formData.description,
  defaultRole: formData.audience === "EMPLOYEE_TASK" ? "EMPLOYEE" : "PARENT",
  isActive: true,
  organisationId: "",
  createdBy: "",
  kind: formData.category as TaskKind,
});

export const applyTemplateToForm = (
  formData: Task,
  template: TaskTemplate | TaskLibrary,
): Task => ({
  ...formData,
  category: template.kind,
  name: template.name || "",
  description:
    (template as TaskTemplate).description ||
    (template as TaskLibrary).defaultDescription ||
    "",
});

export const toTemplateOptions = (list: Array<TaskTemplate | TaskLibrary>): Option[] =>
  (list || []).map((t: any) => ({
    label: t.name || "Untitled template",
    value: t.id || t._id,
  }));
