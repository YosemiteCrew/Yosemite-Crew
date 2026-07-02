import type { Option } from '@/app/features/companions/types/companion';

/**
 * Single source of truth for the task taxonomy used across every task surface:
 * the main /tasks module (add/view/edit), the workspace in-patient schedule,
 * the Quick Actions tasks panel, and the /forms "Building a template" builder.
 *
 * `category` is the user-facing, free-form-on-the-backend value (Prisma
 * `Task.category` is a String). `kind` is the constrained Prisma `TaskKind`
 * enum; `categoryToKind` maps a category to a kind and falls back to `CUSTOM`
 * for values the backend enum does not (yet) accept, so writes never break
 * before the enum-expansion migration lands.
 */

export type TaskCategory =
  | 'MEDICATION'
  | 'CARE'
  | 'DIET'
  | 'PROCEDURE'
  | 'DIAGNOSTIC'
  | 'COMMUNICATION'
  | 'BILLING'
  | 'RECORD'
  | 'ADMIN'
  | 'CUSTOM';

/** Constrained Prisma enum. Superset of the categories once the migration lands. */
export type TaskKind =
  | TaskCategory
  // Legacy kinds still accepted on read for back-compat with existing data.
  | 'OBSERVATION_TOOL'
  | 'HYGIENE';

export type TaskAudience = 'EMPLOYEE_TASK' | 'PARENT_TASK';

/**
 * Scope for editing/deleting a task that belongs to a recurring series. Mirrors the
 * Google-Calendar 3-way choice. Sent to the backend as a `scope` query/body param;
 * the backend resolves it against the master/child task relationship (handoff).
 */
export type RecurrenceScope = 'THIS' | 'THIS_AND_FOLLOWING' | 'ALL';

export const RECURRENCE_SCOPE_OPTIONS: { label: string; value: RecurrenceScope }[] = [
  { label: 'This task only', value: 'THIS' },
  { label: 'This and following tasks', value: 'THIS_AND_FOLLOWING' },
  { label: 'All tasks in the series', value: 'ALL' },
];

/**
 * True when a task participates in a recurring series — either the master
 * (`recurrence.isMaster`) or a materialized child (`recurrence.masterTaskId`).
 * One-off tasks (type ONCE, no master link) return false.
 */
export const isSeriesTask = (recurrence?: {
  type?: string;
  isMaster?: boolean;
  masterTaskId?: string;
}): boolean => {
  if (!recurrence) return false;
  if (recurrence.masterTaskId) return true;
  return Boolean(recurrence.isMaster) && (recurrence.type ?? 'ONCE') !== 'ONCE';
};

export type TaskRecurrenceType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'CUSTOM';

/** Canonical, user-facing category list (label + value). Value === category. */
export const TASK_CATEGORY_OPTIONS: Option[] = [
  { label: 'Medication', value: 'MEDICATION' },
  { label: 'Care', value: 'CARE' },
  { label: 'Diet', value: 'DIET' },
  { label: 'Procedure', value: 'PROCEDURE' },
  { label: 'Diagnostic', value: 'DIAGNOSTIC' },
  { label: 'Communication', value: 'COMMUNICATION' },
  { label: 'Billing', value: 'BILLING' },
  { label: 'Record', value: 'RECORD' },
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Custom', value: 'CUSTOM' },
];

const TASK_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  TASK_CATEGORY_OPTIONS.map((option) => [option.value, option.label])
);

/** Human label for any stored category value (falls back to the raw value). */
export const getTaskCategoryLabel = (category?: string): string => {
  if (!category) return '';
  return TASK_CATEGORY_LABELS[category] ?? category;
};

const TASK_CATEGORY_CODES_BY_LABEL: Record<string, string> = Object.fromEntries(
  TASK_CATEGORY_OPTIONS.map((option) => [option.label.toLowerCase(), option.value])
);

/**
 * Resolve a display label (e.g. "Care") OR an already-canonical code (e.g. "CARE")
 * back to the canonical category code, so tasks created from label-based surfaces
 * (the workspace schedule rows) persist the same code as the rest of the system.
 */
export const categoryFromLabel = (value?: string): string => {
  const raw = (value ?? '').trim();
  if (!raw) return DEFAULT_TASK_CATEGORY;
  const upper = raw.toUpperCase();
  if (TASK_CATEGORY_LABELS[upper]) return upper; // already a code
  return TASK_CATEGORY_CODES_BY_LABEL[raw.toLowerCase()] ?? raw;
};

/** Categories the (current) Prisma `TaskKind` enum already accepts. */
const NATIVE_KINDS = new Set<string>([
  'MEDICATION',
  'OBSERVATION_TOOL',
  'HYGIENE',
  'DIET',
  'CUSTOM',
]);

/**
 * Map a category to a Prisma `TaskKind`. Once the enum is expanded the category
 * value IS a valid kind; until then anything outside the native set degrades to
 * `CUSTOM` so template/library writes never 500.
 */
export const categoryToKind = (category?: string): TaskKind => {
  const value = (category ?? '').trim().toUpperCase();
  if (!value) return 'CUSTOM';
  if (NATIVE_KINDS.has(value)) return value as TaskKind;
  return 'CUSTOM';
};

export const DEFAULT_TASK_CATEGORY: TaskCategory = 'CARE';

/* ───────────────────────────── Audience ───────────────────────────── */

export const TASK_AUDIENCE_OPTIONS: Option[] = [
  { label: 'Employee task', value: 'EMPLOYEE_TASK' },
  { label: 'Parent task', value: 'PARENT_TASK' },
];

/* ───────────────────────────── Reminder ───────────────────────────── */

/** Sentinel value for "No reminder" — distinguishes "none" from an unset 0. */
export const NO_REMINDER_VALUE = 'NONE';

export const TASK_REMINDER_OPTIONS: Option[] = [
  { label: 'No reminder', value: NO_REMINDER_VALUE },
  { label: '5 minutes before', value: '5' },
  { label: '15 minutes before', value: '15' },
  { label: '30 minutes before', value: '30' },
  { label: '1 hour before', value: '60' },
  { label: '1 day before', value: '1440' },
];

/** Dropdown value → reminder offset minutes (undefined when "No reminder"). */
export const reminderValueToOffset = (value?: string): number | undefined => {
  if (!value || value === NO_REMINDER_VALUE) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/** Reminder offset minutes → the dropdown value to preselect. */
export const offsetToReminderValue = (offsetMinutes?: number): string => {
  if (typeof offsetMinutes !== 'number' || offsetMinutes <= 0) return NO_REMINDER_VALUE;
  return String(offsetMinutes);
};

/* ───────────────────────────── Repeat ───────────────────────────── */

type RepeatDefinition = {
  label: string;
  value: string;
  type: TaskRecurrenceType;
  /** Cron expression for interval repeats stored as CUSTOM. */
  cron?: string;
};

/**
 * Repeat options shown in every task picker. Hour-interval repeats (every 6/12h,
 * every 2 days) are stored as `recurrence.type = 'CUSTOM'` with a cron so the
 * backend recurrence engine can materialize them; the simple ones map to the
 * native ONCE/DAILY/WEEKLY types.
 */
export const TASK_REPEAT_DEFINITIONS: RepeatDefinition[] = [
  { label: 'Does not repeat', value: 'ONCE', type: 'ONCE' },
  { label: 'Every 6 hours', value: 'EVERY_6_HOURS', type: 'CUSTOM', cron: '0 */6 * * *' },
  { label: 'Every 12 hours', value: 'EVERY_12_HOURS', type: 'CUSTOM', cron: '0 */12 * * *' },
  { label: 'Daily', value: 'DAILY', type: 'DAILY' },
  { label: 'Every 2 days', value: 'EVERY_2_DAYS', type: 'CUSTOM', cron: '0 9 */2 * *' },
  { label: 'Weekly', value: 'WEEKLY', type: 'WEEKLY' },
  { label: 'Custom', value: 'CUSTOM', type: 'CUSTOM' },
];

export const TASK_REPEAT_OPTIONS: Option[] = TASK_REPEAT_DEFINITIONS.map(({ label, value }) => ({
  label,
  value,
}));

const REPEAT_BY_VALUE: Record<string, RepeatDefinition> = Object.fromEntries(
  TASK_REPEAT_DEFINITIONS.map((definition) => [definition.value, definition])
);

/** Dropdown repeat value → backend recurrence `{ type, cronExpression? }`. */
export const repeatValueToRecurrence = (
  value?: string
): { type: TaskRecurrenceType; cronExpression?: string } => {
  const definition = value ? REPEAT_BY_VALUE[value] : undefined;
  if (!definition) return { type: 'ONCE' };
  return { type: definition.type, cronExpression: definition.cron };
};

/** Backend recurrence `{ type, cronExpression? }` → the dropdown value to preselect. */
export const recurrenceToRepeatValue = (recurrence?: {
  type?: string;
  cronExpression?: string;
}): string => {
  if (!recurrence?.type || recurrence.type === 'ONCE') return 'ONCE';
  if (recurrence.type === 'CUSTOM') {
    const matched = TASK_REPEAT_DEFINITIONS.find(
      (definition) => definition.cron && definition.cron === recurrence.cronExpression
    );
    return matched?.value ?? 'CUSTOM';
  }
  const matched = TASK_REPEAT_DEFINITIONS.find(
    (definition) => definition.type === recurrence.type && !definition.cron
  );
  return matched?.value ?? 'ONCE';
};
