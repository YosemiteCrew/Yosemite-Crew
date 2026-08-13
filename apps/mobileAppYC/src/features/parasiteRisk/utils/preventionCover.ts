import type {Task} from '@/features/tasks/types';

/**
 * Cross-reference modelled local risk against the pet's own prevention tasks.
 *
 * This is the part the forecast alone cannot tell you: whether *this* pet is
 * actually covered right now. A high tick index matters a great deal if cover
 * lapsed three weeks ago and very little if it did not.
 *
 * Note: a stored Task records the `parasite-prevention` subcategory but not
 * which kind of prevention it was (worming vs flea and tick), so cover is
 * treated as a single bucket and worded generically. Splitting it would need
 * the subtype persisted on the task first.
 */

export type PreventionCover =
  | {status: 'covered'; lastCompletedAt: string | null}
  | {status: 'lapsed'; daysOverdue: number}
  | {status: 'none'};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isParasitePreventionTask = (task: Task): boolean =>
  task.subcategory === 'parasite-prevention';

// Task.status arrives in either the API's upper case form or the local lower
// case one, so it is normalised once here rather than at every comparison.
const statusOf = (task: Task): string => task.status.toLowerCase();

const isCompleted = (task: Task): boolean => statusOf(task) === 'completed';

const isCancelled = (task: Task): boolean => statusOf(task) === 'cancelled';

const dueTimestamp = (task: Task): number | null => {
  const raw = task.dueAt ?? task.date;
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

const daysBetween = (from: number, to: number): number =>
  Math.max(0, Math.floor((to - from) / MS_PER_DAY));

/**
 * Resolve the pet's parasite prevention cover.
 *
 * `now` is injected so this stays deterministic under test.
 */
export function resolvePreventionCover(
  tasks: readonly Task[],
  now: number = Date.now(),
): PreventionCover {
  const relevant = tasks.filter(
    task => isParasitePreventionTask(task) && !isCancelled(task),
  );

  if (relevant.length === 0) return {status: 'none'};

  // Sorted newest first, so the head is the most recent completion. Compared
  // explicitly rather than relying on the default sort, which is a stringify
  // comparison that only happens to work for ISO timestamps.
  const completed = relevant
    .filter(isCompleted)
    .map(task => task.completedAt ?? task.dueAt ?? task.date)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a));

  const overdue = relevant
    .filter(task => !isCompleted(task))
    .map(dueTimestamp)
    .filter((value): value is number => value !== null && value < now)
    .sort((a, b) => a - b);

  // An outstanding past-due task is the strongest signal, and we report the
  // oldest one because that is how long there has actually been a gap.
  if (overdue.length > 0) {
    return {status: 'lapsed', daysOverdue: daysBetween(overdue[0], now)};
  }

  return {status: 'covered', lastCompletedAt: completed[0] ?? null};
}

/** Whether the lapsed-cover warning should be shown at all. */
export function shouldWarnAboutCover(cover: PreventionCover): boolean {
  return cover.status !== 'covered';
}
