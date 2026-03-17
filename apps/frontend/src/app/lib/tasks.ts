import { Task, TaskStatus } from '@/app/features/tasks/types/task';

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

export const getTaskQuickDetails = (task: Task) => {
  return [
    { label: 'Category', value: task.category || '-' },
    { label: 'Description', value: task.description || '-' },
    { label: 'Additional notes', value: task.additionalNotes || '-' },
  ];
};
