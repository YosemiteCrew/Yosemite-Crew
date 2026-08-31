import { Task, TaskStatus } from '@/app/features/tasks/types/task';
import { getTaskCategoryLabel } from '@/app/features/tasks/constants/taskTaxonomy';

const ALLOWED_TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  PENDING: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const normalizeTaskStatus = (status?: string | null): TaskStatus | null => {
  if (!status) return null;
  if (
    status === 'PENDING' ||
    status === 'IN_PROGRESS' ||
    status === 'COMPLETED' ||
    status === 'CANCELLED'
  ) {
    return status;
  }
  return null;
};

export const getTaskStatusLabel = (status?: string | null) => {
  const normalized = normalizeTaskStatus(status);
  return normalized ? TASK_STATUS_LABELS[normalized] : 'Unknown';
};

export const getAllowedTaskStatusTransitions = (status?: string | null): TaskStatus[] => {
  const normalized = normalizeTaskStatus(status);
  if (!normalized) return [];
  return ALLOWED_TASK_STATUS_TRANSITIONS[normalized];
};

export const canTransitionTaskStatus = (
  status: string | null | undefined,
  nextStatus: TaskStatus
) => {
  const normalized = normalizeTaskStatus(status);
  if (!normalized) return false;
  if (normalized === nextStatus) return true;
  return ALLOWED_TASK_STATUS_TRANSITIONS[normalized].includes(nextStatus);
};

export const canShowTaskStatusChangeAction = (status?: string | null) => {
  return getAllowedTaskStatusTransitions(status).length > 0;
};

export const canRescheduleTask = (status?: string | null) => {
  const normalized = normalizeTaskStatus(status);
  if (!normalized) return false;
  return normalized === 'PENDING' || normalized === 'IN_PROGRESS';
};

export const getPreferredNextTaskStatus = (status?: string | null): TaskStatus | null => {
  return getAllowedTaskStatusTransitions(status)[0] ?? null;
};

export const getInvalidTaskStatusTransitionMessage = (
  status: string | null | undefined,
  nextStatus: TaskStatus
) => {
  const from = normalizeTaskStatus(status);
  const toLabel = getTaskStatusLabel(nextStatus);
  if (!from) return `Cannot change task status to ${toLabel}.`;
  if (from === nextStatus) return '';
  return `${TASK_STATUS_LABELS[from]} tasks cannot be moved to ${toLabel}.`;
};

/**
 * Instructions shown on a task. The add/edit form writes `description`;
 * workflow-materialized tasks carry their instructions in `additionalNotes`
 * instead (see the backend task-workflow-materializer), so read through to it
 * rather than stranding that text behind a field the UI no longer surfaces.
 */
export const getTaskInstructions = (task: Task) => task.description || task.additionalNotes || '';

/**
 * `category` is persisted as a canonical code, so handing it straight to the UI
 * put a raw `MEDICATION` on the phone task card and in the calendar popover while
 * the desktop table row beside it read "Medication" - the same task, spelled two
 * ways depending on the width of the screen. `getTaskCategoryLabel` maps a known
 * code to its label and passes anything unrecognised through unchanged, so a
 * category the taxonomy has not caught up with still shows rather than blanking.
 */
export const getTaskQuickDetails = (task: Task) => {
  return [
    { label: 'Category', value: getTaskCategoryLabel(task.category) || '-' },
    { label: 'Instructions (optional)', value: getTaskInstructions(task) || '-' },
  ];
};
