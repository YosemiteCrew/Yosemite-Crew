import {
  getDateKeyInPreferredTimeZone,
  getDatePartsInPreferredTimeZone,
  getPreferredTimeZone,
} from '@/app/lib/timezone';
import type { Task, TaskStatus } from '@/app/features/tasks/types/task';

/**
 * Phone tasks day list — pure derivation.
 *
 * A time grid cannot shrink to a phone, so below 768px the tasks planner becomes
 * a thumb-checkable day list bucketed into Overdue / Today / Later this week.
 * Every rule here is timezone-anchored via `getDateKeyInPreferredTimeZone`, so a
 * task never changes bucket just because the browser sits in a different zone to
 * the clinic's preferred one.
 */

export type TaskDayBucketId = 'overdue' | 'today' | 'later';

export type TaskDayEntry = {
  id: string;
  task: Task;
  /** Usable due instant. Entries without one are dropped, never bucketed. */
  at: Date;
  status: TaskStatus;
  isDone: boolean;
  isOverdue: boolean;
  /** Whole minutes past due, relative to `now`. 0 unless `isOverdue`. */
  overdueMinutes: number;
};

export type TaskDayGroup = {
  id: TaskDayBucketId;
  label: string;
  count: number;
  entries: TaskDayEntry[];
};

export type TaskDayList = {
  /** Only non-empty buckets, ordered overdue → today → later. */
  groups: TaskDayGroup[];
  totalCount: number;
  overdueCount: number;
};

export type TaskDayListInput = {
  tasks: Task[];
  /** Reference instant — drives overdue detection. */
  now: Date;
  /** Day the list is anchored to. Defaults to `now`. */
  anchor?: Date;
};

/** Statuses that take a task out of the running — never overdue, never actionable. */
const TERMINAL_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  'COMPLETED',
  'CANCELLED',
]);

/** Days after the anchor that still count as "later this week" (rolling window). */
const LATER_WINDOW_DAYS = 6;

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

export const toTaskDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

/** "14:00" in the preferred zone — never the browser's zone. */
export const formatTaskDueTime = (value: Date): string => {
  const { hour, minute } = getDatePartsInPreferredTimeZone(value);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const formatOverdueLabel = (overdueMinutes: number): string => {
  if (overdueMinutes <= 0) return 'due now';
  if (overdueMinutes < MINUTES_PER_HOUR) return `${overdueMinutes} min overdue`;
  if (overdueMinutes < MINUTES_PER_DAY) {
    const hours = Math.floor(overdueMinutes / MINUTES_PER_HOUR);
    return `${hours} hr overdue`;
  }
  const days = Math.floor(overdueMinutes / MINUTES_PER_DAY);
  return `${days} ${days === 1 ? 'day' : 'days'} overdue`;
};

/**
 * "Due 14:00 · 26 min overdue · you" — the trailing name is the assignee.
 * Parts with no backing value are dropped rather than rendered empty.
 */
export const buildTaskDaySubtitle = (entry: TaskDayEntry, assigneeName?: string): string => {
  const parts = [`Due ${formatTaskDueTime(entry.at)}`];
  if (entry.isOverdue) parts.push(formatOverdueLabel(entry.overdueMinutes));
  const name = assigneeName?.trim();
  if (name) parts.push(name);
  return parts.join(' · ');
};

const BUCKET_ORDER: Record<TaskDayBucketId, number> = { overdue: 0, today: 1, later: 2 };

/**
 * `anchor` is today → "Today"; stepping the header off today would make that
 * label a lie, so the middle bucket names the day it actually holds.
 */
const buildTodayLabel = (anchor: Date, now: Date): string => {
  if (getDateKeyInPreferredTimeZone(anchor) === getDateKeyInPreferredTimeZone(now)) return 'Today';
  return anchor.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: getPreferredTimeZone(),
  });
};

const bucketFor = (
  entry: Omit<TaskDayEntry, 'id'>,
  anchorKey: string,
  laterEndKey: string
): TaskDayBucketId | null => {
  const dueKey = getDateKeyInPreferredTimeZone(entry.at);
  // Overdue absorbs anything still open and already past — including earlier days,
  // which is why it is tested before the same-day check.
  if (entry.isOverdue && dueKey <= anchorKey) return 'overdue';
  if (dueKey === anchorKey) return 'today';
  if (dueKey > anchorKey && dueKey <= laterEndKey) return 'later';
  // Beyond the window, or a settled task from a past day: not this list's problem.
  return null;
};

const compareEntries = (a: TaskDayEntry, b: TaskDayEntry): number => {
  const delta = a.at.getTime() - b.at.getTime();
  if (delta !== 0) return delta;
  return a.id.localeCompare(b.id);
};

/**
 * Bucket tasks into Overdue / Today / Later this week.
 *
 * A task is Overdue when it is still open (not COMPLETED/CANCELLED) and its due
 * instant is strictly before `now` — a task due exactly now is not yet late.
 * Otherwise it lands in Today when its due date matches the anchor day, or in
 * Later this week when it falls in the following six days. Anything outside that
 * window, and any settled task from a past day, is dropped. All day comparisons
 * run on preferred-timezone date keys, so buckets never shift with the browser.
 */
export const buildTaskDayList = ({ tasks, now, anchor }: TaskDayListInput): TaskDayList => {
  const anchorDate = anchor ?? now;
  const anchorKey = getDateKeyInPreferredTimeZone(anchorDate);
  const laterEndKey = getDateKeyInPreferredTimeZone(addDays(anchorDate, LATER_WINDOW_DAYS));

  const buckets = new Map<TaskDayBucketId, TaskDayEntry[]>();

  tasks.forEach((task, index) => {
    const at = toTaskDate(task.dueAt);
    // A task with no usable due instant cannot be placed on a day list.
    if (!at) return;

    const isDone = TERMINAL_TASK_STATUSES.has(task.status);
    const isOverdue = !isDone && at.getTime() < now.getTime();
    const overdueMinutes = isOverdue ? Math.floor((now.getTime() - at.getTime()) / 60_000) : 0;

    const entry: TaskDayEntry = {
      id: `task:${task._id || index}`,
      task,
      at,
      status: task.status,
      isDone,
      isOverdue,
      overdueMinutes,
    };

    const bucket = bucketFor(entry, anchorKey, laterEndKey);
    if (!bucket) return;

    const existing = buckets.get(bucket);
    if (existing) existing.push(entry);
    else buckets.set(bucket, [entry]);
  });

  const todayLabel = buildTodayLabel(anchorDate, now);
  const labels: Record<TaskDayBucketId, string> = {
    overdue: 'Overdue',
    today: todayLabel,
    later: 'Later this week',
  };

  const groups = [...buckets.entries()]
    .map(([id, entries]) => ({
      id,
      label: labels[id],
      count: entries.length,
      entries: [...entries].sort(compareEntries),
    }))
    .sort((a, b) => BUCKET_ORDER[a.id] - BUCKET_ORDER[b.id]);

  return {
    groups,
    totalCount: groups.reduce((total, group) => total + group.count, 0),
    overdueCount: buckets.get('overdue')?.length ?? 0,
  };
};

/** "Overdue · 1" — the design's group heading. */
export const buildGroupHeading = (group: TaskDayGroup): string => `${group.label} · ${group.count}`;
