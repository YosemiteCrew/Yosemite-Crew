import { Task, TaskLibrary, TaskTemplate } from '@/app/features/tasks/types/task';
import { Option } from '@/app/features/companions/types/companion';
import { categoryToKind } from '@/app/features/tasks/constants/taskTaxonomy';

export type TaskFormErrors = {
  name?: string;
  assignedTo?: string;
  category?: string;
  dueAt?: string;
  endDate?: string;
  reminder?: string;
  templateId?: string;
  libraryTaskId?: string;
};

/** Reminder is invalid when enabled with a non-positive offset. */
const getReminderError = (reminder?: Task['reminder']): string | undefined => {
  if (!reminder?.enabled) return undefined;
  const minutes = Number(reminder.offsetMinutes);
  return Number.isFinite(minutes) && minutes > 0
    ? undefined
    : 'Reminder minutes must be greater than 0';
};

/** A repeating task needs an end date that is on/after the due date. */
const getEndDateError = (recurrence?: Task['recurrence'], dueAt?: Date): string | undefined => {
  if (!recurrence || recurrence.type === 'ONCE') return undefined;
  const endDate = recurrence.endDate ? new Date(recurrence.endDate) : undefined;
  if (!endDate || Number.isNaN(endDate.getTime())) {
    return 'End date is required for a repeating task';
  }
  if (dueAt && endDate < new Date(dueAt)) {
    return 'End date must be on or after the due date';
  }
  return undefined;
};

export const validateTaskForm = (formData: Task): TaskFormErrors => {
  const errors: TaskFormErrors = {};
  if (!formData.assignedTo?.trim()) errors.assignedTo = 'Please select a companion or staff';
  if (!formData.name?.trim()) errors.name = 'Name is required';
  if (!formData.category?.trim()) errors.category = 'Category is required';
  if (!formData.dueAt || Number.isNaN(new Date(formData.dueAt).getTime())) {
    errors.dueAt = 'Due date and time are required';
  }
  if (formData.audience === 'PARENT_TASK' && !formData.companionId) {
    errors.assignedTo = 'Please select a valid companion';
  }
  const reminderError = getReminderError(formData.reminder);
  if (reminderError) errors.reminder = reminderError;
  const endDateError = getEndDateError(formData.recurrence, formData.dueAt);
  if (endDateError) errors.endDate = endDateError;
  return errors;
};

export const buildTaskTemplate = (formData: Task): TaskTemplate => ({
  _id: '',
  source: 'ORG_TEMPLATE',
  category: formData.category,
  name: formData.name,
  description: formData.description,
  defaultRole: formData.audience === 'EMPLOYEE_TASK' ? 'EMPLOYEE' : 'PARENT',
  isActive: true,
  organisationId: '',
  createdBy: '',
  kind: categoryToKind(formData.category),
});

/**
 * Prefill the task form from a selected template. "Load from template" copies the
 * template's defaults into the editable form, so the resulting task is created as
 * a normal CUSTOM task (the values now live on the form) — we deliberately do NOT
 * flip `source` to ORG_TEMPLATE/YC_LIBRARY, which would route createTask through
 * the backend's single-task template endpoint and mismatch multi-task YC-default
 * templates that have no `TaskTemplate` row.
 */
export const applyTemplateToForm = (formData: Task, template: TaskTemplate | TaskLibrary): Task => {
  const orgTemplate = template.source === 'ORG_TEMPLATE' ? (template as TaskTemplate) : undefined;
  const reminderOffset = orgTemplate?.defaultReminderOffsetMinutes;
  const recurrenceType = orgTemplate?.defaultRecurrence?.type;
  return {
    ...formData,
    source: 'CUSTOM',
    templateId: undefined,
    libraryTaskId: undefined,
    category: template.category || template.kind,
    name: template.name || '',
    description:
      (template as TaskTemplate).description || (template as TaskLibrary).defaultDescription || '',
    // Carry the template's default reminder/recurrence so the picker reflects them.
    reminder:
      typeof reminderOffset === 'number' && reminderOffset > 0
        ? { enabled: true, offsetMinutes: reminderOffset }
        : formData.reminder,
    recurrence: recurrenceType
      ? {
          ...formData.recurrence,
          type: recurrenceType,
          isMaster: recurrenceType !== 'ONCE',
        }
      : formData.recurrence,
  };
};

export const toTemplateOptions = (list: Array<TaskTemplate | TaskLibrary>): Option[] =>
  (list || []).map((t: any) => ({
    label: t.name || 'Untitled template',
    value: t.id || t._id,
  }));
