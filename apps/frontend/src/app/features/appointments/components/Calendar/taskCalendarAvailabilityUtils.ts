import { Task } from '@/app/features/tasks/types/task';
import { getProfileForUserForPrimaryOrg } from '@/app/features/organization/services/teamService';
import { logger } from '@/app/lib/logger';
import {
  formatDateInPreferredTimeZone,
  utcClockTimeToPreferredTimeZoneClock,
} from '@/app/lib/timezone';

export type DropAvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

export type AvailabilitySlot = {
  isAvailable?: boolean;
  startTime?: string;
  endTime?: string;
};

export type AvailabilityDayEntry = {
  dayOfWeek?: string;
  slots?: AvailabilitySlot[];
};

type AbsoluteMinuteRange = {
  start: number;
  end: number;
};

export const WEEKDAY_ORDER = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export const TASK_BLOCK_DURATION_MINUTES = 30;

export const normalizeCalendarId = (value?: string) =>
  String(value ?? '')
    .trim()
    .split('/')
    .pop()
    ?.toLowerCase() ?? '';

export const clampCalendarMinutes = (minutes: number) =>
  Math.max(0, Math.min(24 * 60 - 5, Math.round(minutes / 5) * 5));

export const getCalendarDayKey = (date: Date) =>
  formatDateInPreferredTimeZone(date, { weekday: 'long' }).toUpperCase();

export const shouldAllowTaskAvailabilityBypass = (
  authUserId: string,
  task: Task,
  normalizeId: (value?: string) => string
) => {
  const normalizedCurrentUser = normalizeId(authUserId);
  const isAssignedByCurrentUser =
    !!normalizedCurrentUser && normalizeId(task.assignedBy) === normalizedCurrentUser;
  // Availability is enforced for everyone except the user who created the
  // assignment, who is trusted to schedule the task freely.
  return !isAssignedByCurrentUser;
};

// Shift a weekday key by a signed day offset, wrapping around the week.
export const shiftWeekdayKey = (dayKey: string, offset: number): string => {
  const upper = String(dayKey || '').toUpperCase();
  const index = WEEKDAY_ORDER.indexOf(upper);
  if (index < 0) return upper;
  const shifted = (index + offset) % WEEKDAY_ORDER.length;
  const safe = shifted < 0 ? shifted + WEEKDAY_ORDER.length : shifted;
  return WEEKDAY_ORDER[safe];
};

// A task can be moved only while it is open and the current user created the
// assignment.
export const canCurrentUserEditTask = (
  authUserId: string,
  task: Task,
  normalizeId: (value?: string) => string
) => {
  const normalizedCurrentUser = normalizeId(authUserId);
  const isAssignedByCurrentUser =
    !!normalizedCurrentUser && normalizeId(task.assignedBy) === normalizedCurrentUser;
  return task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && isAssignedByCurrentUser;
};

const getSourceDayKey = (dayEntry: AvailabilityDayEntry) =>
  String(dayEntry?.dayOfWeek ?? '').toUpperCase();

const getAvailabilitySlots = (dayEntry: AvailabilityDayEntry) =>
  Array.isArray(dayEntry?.slots) ? dayEntry.slots : [];

const getAbsoluteMinuteRange = (slot: AvailabilitySlot): AbsoluteMinuteRange => {
  const startClock = utcClockTimeToPreferredTimeZoneClock(slot?.startTime || '');
  const endClock = utcClockTimeToPreferredTimeZoneClock(slot?.endTime || '');
  const start = startClock.dayOffset * 1440 + startClock.minutes;
  let end = endClock.dayOffset * 1440 + endClock.minutes;
  if (end <= start) end += 1440;
  return { start, end };
};

const getDayOffsetBounds = (range: AbsoluteMinuteRange) => {
  const latestStart = range.end - TASK_BLOCK_DURATION_MINUTES;
  if (latestStart < range.start) return null;
  return {
    latestStart,
    firstDayOffset: Math.floor(range.start / 1440),
    lastDayOffset: Math.floor(latestStart / 1440),
  };
};

const appendAvailabilityInterval = (
  output: Record<string, DropAvailabilityInterval[]>,
  sourceDayKey: string,
  offset: number,
  rangeStart: number,
  latestStart: number,
  shiftKey: (dayKey: string, offset: number) => string
) => {
  const dayStartMinute = offset * 1440;
  const localStart = Math.max(rangeStart, dayStartMinute);
  const localEnd = Math.min(latestStart, dayStartMinute + 1435);
  if (localEnd < localStart) return;
  const dayKey = shiftKey(sourceDayKey, offset);
  if (!output[dayKey]) output[dayKey] = [];
  output[dayKey].push({
    startMinute: localStart - dayStartMinute,
    endMinute: localEnd - dayStartMinute,
  });
};

const appendSlotIntervals = (
  output: Record<string, DropAvailabilityInterval[]>,
  sourceDayKey: string,
  slot: AvailabilitySlot,
  shiftKey: (dayKey: string, offset: number) => string
) => {
  if (slot?.isAvailable === false) return;
  const range = getAbsoluteMinuteRange(slot);
  const bounds = getDayOffsetBounds(range);
  if (!bounds) return;
  const { firstDayOffset, lastDayOffset, latestStart } = bounds;
  for (let offset = firstDayOffset; offset <= lastDayOffset; offset++) {
    appendAvailabilityInterval(output, sourceDayKey, offset, range.start, latestStart, shiftKey);
  }
};

const appendDayIntervals = (
  output: Record<string, DropAvailabilityInterval[]>,
  dayEntry: AvailabilityDayEntry,
  shiftKey: (dayKey: string, offset: number) => string
) => {
  const sourceDayKey = getSourceDayKey(dayEntry);
  if (!sourceDayKey) return;
  for (const slot of getAvailabilitySlots(dayEntry)) {
    appendSlotIntervals(output, sourceDayKey, slot, shiftKey);
  }
};

export const buildAvailabilityOutput = (
  baseAvailability: AvailabilityDayEntry[],
  shiftKey: (dayKey: string, offset: number) => string
): Record<string, DropAvailabilityInterval[]> => {
  const output: Record<string, DropAvailabilityInterval[]> = {};
  for (const dayEntry of baseAvailability) {
    appendDayIntervals(output, dayEntry, shiftKey);
  }
  return output;
};

// Fetch an assignee's base availability and reduce it to per-day drop intervals.
// Any fetch failure resolves to an empty map so callers can cache a definitive
// (if empty) result rather than retrying indefinitely.
export const fetchAssigneeAvailability = async (
  assigneeId: string,
  shiftDayKey: (dayKey: string, offset: number) => string
): Promise<Record<string, DropAvailabilityInterval[]>> => {
  try {
    const profile = (await getProfileForUserForPrimaryOrg(assigneeId)) as {
      baseAvailability?: AvailabilityDayEntry[];
    };
    const baseAvailability = Array.isArray(profile?.baseAvailability)
      ? profile.baseAvailability
      : [];
    return buildAvailabilityOutput(baseAvailability, shiftDayKey);
  } catch (error) {
    logger.warn('Failed to load assignee availability.', error);
    return {};
  }
};

// Run `work` at most once per key concurrently: concurrent callers for the same
// key await the in-flight promise instead of starting a duplicate. The pending
// entry is cleared once settled.
export const runOncePerKey = async (
  pending: Partial<Record<string, Promise<void>>>,
  key: string,
  work: () => Promise<void>
): Promise<void> => {
  const inFlight = pending[key];
  if (inFlight) {
    await inFlight;
    return;
  }
  const task = work();
  pending[key] = task;
  try {
    await task;
  } finally {
    delete pending[key];
  }
};

const FULL_DAY_INTERVAL: DropAvailabilityInterval = {
  startMinute: 0,
  endMinute: 24 * 60 - TASK_BLOCK_DURATION_MINUTES,
};

type AvailabilityCache = Record<string, Record<string, DropAvailabilityInterval[]>>;

// Read the cached drop intervals for an assignee on a given day, returning a
// full-day window when availability enforcement is bypassed for the dragged task.
export const readDropAvailabilityIntervals = (
  cache: AvailabilityCache,
  date: Date,
  targetAssigneeId: string | undefined,
  deps: {
    draggedTask?: Task;
    resolveAssigneeId: (candidateId?: string) => string;
    shouldEnforceAvailability: (task: Task, targetAssigneeId?: string) => boolean;
  }
): DropAvailabilityInterval[] => {
  if (deps.draggedTask && !deps.shouldEnforceAvailability(deps.draggedTask, targetAssigneeId)) {
    return [FULL_DAY_INTERVAL];
  }
  const resolvedAssigneeId = deps.resolveAssigneeId(targetAssigneeId);
  if (!resolvedAssigneeId) return [];
  const assigneeKey = normalizeCalendarId(resolvedAssigneeId);
  return cache[assigneeKey]?.[getCalendarDayKey(date)] || [];
};

// True when the given minute falls inside any drop interval.
export const isMinuteWithinIntervals = (minute: number, intervals: DropAvailabilityInterval[]) =>
  intervals.some((interval) => minute >= interval.startMinute && minute <= interval.endMinute);
