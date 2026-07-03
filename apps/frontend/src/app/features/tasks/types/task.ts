import {
  filter,
  FilterOption,
  status,
  StatusOption,
} from '@/app/features/companions/pages/Companions/types';
import { type TaskKind as CanonicalTaskKind } from '@/app/features/tasks/constants/taskTaxonomy';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type RecurrenceType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'CUSTOM';
export type TaskKind = CanonicalTaskKind;

/** Repeat options shown in task pickers (single-sourced from the taxonomy). */
export { TASK_REPEAT_OPTIONS as TaskRecurrenceOptions } from '@/app/features/tasks/constants/taskTaxonomy';

/** Category options shown in task pickers (single-sourced from the taxonomy). */
export { TASK_CATEGORY_OPTIONS as TaskKindOptions } from '@/app/features/tasks/constants/taskTaxonomy';

export const TaskStatusOptions = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export type Task = {
  _id: string;
  organisationId?: string;
  appointmentId?: string;
  companionId?: string;
  createdBy?: string;
  assignedBy?: string;
  assignedTo: string;
  audience: 'EMPLOYEE_TASK' | 'PARENT_TASK';
  source: 'YC_LIBRARY' | 'ORG_TEMPLATE' | 'CUSTOM';
  libraryTaskId?: string;
  templateId?: string;
  category: string;
  name: string;
  description?: string;
  additionalNotes?: string;
  medication?: {
    name?: string;
    type?: string;
    notes?: string;
    doses?: {
      dosage?: string;
      time?: string;
      frequency?: string;
    }[];
  };
  observationToolId?: string;
  dueAt: Date;
  timezone?: string;
  recurrence?: {
    type: RecurrenceType;
    isMaster: boolean;
    masterTaskId?: string;
    cronExpression?: string;
    endDate?: Date;
  };
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
    scheduledNotificationId?: string;
  };
  syncWithCalendar?: boolean;
  calendarEventId?: string;
  attachments?: {
    id: string;
    name: string;
  }[];
  status: TaskStatus;
  completedAt?: Date;
  completedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TaskTemplate = {
  _id: string;
  source: 'ORG_TEMPLATE';
  organisationId: string;
  libraryTaskId?: string;
  category: string;
  name: string;
  description?: string;
  kind: TaskKind;
  defaultRole: 'EMPLOYEE' | 'PARENT';
  defaultMedication?: {
    name?: string;
    type?: string;
    dosage?: string;
    frequency?: string;
  };
  defaultObservationToolId?: string;
  defaultRecurrence?: {
    type: 'ONCE' | 'DAILY' | 'WEEKLY' | 'CUSTOM';
    customCron?: string;
    defaultEndOffsetDays?: number;
  };
  defaultReminderOffsetMinutes?: number;
  isActive: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TaskLibrary = {
  _id: string;
  source: 'YC_LIBRARY';
  kind: TaskKind;
  category: string;
  name: string;
  defaultDescription?: string;
  schema: {
    medicationFields?: {
      hasMedicationName?: boolean;
      hasType?: boolean;
      hasDosage?: boolean;
      hasFrequency?: boolean;
    };
    requiresObservationTool?: boolean;
    allowsRecurrence?: boolean;
  };
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export const EMPTY_TASK: Task = {
  _id: '',
  assignedTo: '',
  audience: 'EMPLOYEE_TASK',
  source: 'CUSTOM',
  libraryTaskId: undefined,
  templateId: undefined,
  category: 'CARE',
  recurrence: {
    type: 'ONCE',
    isMaster: false,
  },
  name: '',
  description: '',
  dueAt: new Date(),
  status: 'PENDING',
};

export const EMPTY_COMPANION_TASK: Task = {
  _id: '',
  assignedTo: '',
  audience: 'PARENT_TASK',
  source: 'CUSTOM',
  libraryTaskId: undefined,
  templateId: undefined,
  category: 'CARE',
  recurrence: {
    type: 'ONCE',
    isMaster: false,
  },
  name: '',
  description: '',
  dueAt: new Date(),
  status: 'PENDING',
};

export const TaskStatusFilters: StatusOption[] = [
  status(
    'All',
    'all',
    'var(--color-pill-neutral-bg)',
    'var(--color-pill-neutral-text)',
    'var(--color-pill-neutral-border)',
    'var(--color-pill-neutral-text)'
  ),
  status(
    'Pending',
    'pending',
    'var(--color-pill-neutral-bg)',
    'var(--color-pill-neutral-text)',
    'var(--color-pill-neutral-border)',
    'var(--color-pill-neutral-text)'
  ),
  status(
    'In progress',
    'in_progress',
    'var(--color-pill-progress-bg)',
    'var(--color-pill-progress-text)',
    'var(--color-pill-progress-border)',
    'var(--color-pill-progress-text)'
  ),
  status(
    'Completed',
    'completed',
    'var(--color-pill-success-bg)',
    'var(--color-pill-success-text)',
    'var(--color-pill-success-border)',
    'var(--color-pill-success-text)'
  ),
  status(
    'Cancelled',
    'cancelled',
    'var(--color-pill-warning-bg)',
    'var(--color-pill-warning-text)',
    'var(--color-pill-warning-border)',
    'var(--color-pill-warning-text)'
  ),
];

export const TaskFilters: FilterOption[] = [
  filter('All', 'all'),
  filter('Organizations', 'employee_task'),
  filter('Companions', 'parent_task'),
];
