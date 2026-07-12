import { Task } from '@/app/features/tasks/types/task';
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
  normalizeId: (value?: string) => string,
  resolveAssigneeId: (candidateId?: string) => string,
  targetAssigneeId?: string
) => {
  const normalizedCurrentUser = normalizeId(authUserId);
  const isAssignedByCurrentUser =
    !!normalizedCurrentUser && normalizeId(task.assignedBy) === normalizedCurrentUser;
  if (isAssignedByCurrentUser) return false;
  const currentAssignee = resolveAssigneeId(task.assignedTo);
  const nextAssignee = resolveAssigneeId(targetAssigneeId || task.assignedTo);
  return normalizeId(nextAssignee) !== normalizeId(currentAssignee) || true;
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

export const buildAvailabilityOutput = (
  baseAvailability: AvailabilityDayEntry[],
  shiftKey: (dayKey: string, offset: number) => string
): Record<string, DropAvailabilityInterval[]> => {
  const output: Record<string, DropAvailabilityInterval[]> = {};
  for (const dayEntry of baseAvailability) {
    const sourceDayKey = getSourceDayKey(dayEntry);
    if (!sourceDayKey) continue;
    for (const slot of getAvailabilitySlots(dayEntry)) {
      if (slot?.isAvailable === false) continue;
      const range = getAbsoluteMinuteRange(slot);
      const bounds = getDayOffsetBounds(range);
      if (!bounds) continue;
      for (let offset = bounds.firstDayOffset; offset <= bounds.lastDayOffset; offset++) {
        appendAvailabilityInterval(
          output,
          sourceDayKey,
          offset,
          range.start,
          bounds.latestStart,
          shiftKey
        );
      }
    }
  }
  return output;
};
