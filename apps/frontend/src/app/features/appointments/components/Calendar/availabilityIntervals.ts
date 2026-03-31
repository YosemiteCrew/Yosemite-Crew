import { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';
import { PreferredTimeZoneClock } from '@/app/lib/timezone';

export type DropAvailabilityInterval = {
  startMinute: number;
  endMinute: number;
};

export const WEEKDAY_KEYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

const DAY_MINUTES = 24 * 60;

const getPreviousWeekdayKey = (dayKey: string): string => {
  const normalized = String(dayKey || '').toUpperCase();
  const index = WEEKDAY_KEYS.indexOf(normalized as (typeof WEEKDAY_KEYS)[number]);
  if (index < 0) return normalized;
  const previous = index === 0 ? WEEKDAY_KEYS.length - 1 : index - 1;
  return WEEKDAY_KEYS[previous];
};

const toAbsoluteInterval = (
  startTime: string,
  endTime: string,
  toLocalClockFromUtcTime: (utcTime: string) => PreferredTimeZoneClock
) => {
  const startClock = toLocalClockFromUtcTime(startTime);
  const endClock = toLocalClockFromUtcTime(endTime);

  const startAbsoluteMinute = startClock.dayOffset * DAY_MINUTES + startClock.minutes;
  let endAbsoluteMinute = endClock.dayOffset * DAY_MINUTES + endClock.minutes;
  if (endAbsoluteMinute <= startAbsoluteMinute) {
    endAbsoluteMinute += DAY_MINUTES;
  }

  return {
    startAbsoluteMinute,
    endAbsoluteMinute,
  };
};

const clipInterval = (
  start: number,
  end: number,
  windowStart: number,
  windowEnd: number,
  shift = 0
): DropAvailabilityInterval | null => {
  const clippedStart = Math.max(windowStart, start);
  const clippedEnd = Math.min(windowEnd, end);
  if (clippedEnd <= clippedStart) return null;

  const shiftedStart = Math.max(0, Math.min(DAY_MINUTES, clippedStart + shift));
  const shiftedEnd = Math.max(0, Math.min(DAY_MINUTES, clippedEnd + shift));
  if (shiftedEnd <= shiftedStart) return null;

  return {
    startMinute: shiftedStart,
    endMinute: shiftedEnd,
  };
};

const mergeIntervals = (intervals: DropAvailabilityInterval[]): DropAvailabilityInterval[] => {
  if (intervals.length <= 1) return intervals;
  const sorted = [...intervals].sort((a, b) => {
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    return a.endMinute - b.endMinute;
  });

  const merged: DropAvailabilityInterval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = merged.at(-1);
    if (!previous) continue;
    if (current.startMinute <= previous.endMinute) {
      previous.endMinute = Math.max(previous.endMinute, current.endMinute);
      continue;
    }
    merged.push({ ...current });
  }
  return merged;
};

const isUserSpecific = (entry: ApiDayAvailability) => {
  return Boolean(entry.userId && String(entry.userId).trim());
};

const resolveSourceEntries = (
  allEntries: ApiDayAvailability[],
  targetIds: Set<string> | undefined,
  normalizeId: (value?: string) => string
): ApiDayAvailability[] => {
  const employeeEntries = allEntries.filter(isUserSpecific);
  const orgEntries = allEntries.filter((entry) => !isUserSpecific(entry));
  const scopedUserEntries =
    targetIds && targetIds.size > 0
      ? employeeEntries.filter((entry) => targetIds.has(normalizeId(entry.userId)))
      : [];

  // Per-user availability takes precedence when available; otherwise use org defaults.
  return scopedUserEntries.length > 0 ? scopedUserEntries : orgEntries;
};

const collectIntervalsForEntry = (
  entry: ApiDayAvailability,
  normalizedDayKey: string,
  previousDayKey: string,
  toLocalClockFromUtcTime: (utcTime: string) => PreferredTimeZoneClock
): DropAvailabilityInterval[] => {
  const rowDay = String(entry.dayOfWeek || '').toUpperCase();
  if (rowDay !== normalizedDayKey && rowDay !== previousDayKey) return [];

  const intervals: DropAvailabilityInterval[] = [];
  const slots = (entry.slots ?? []).filter((slot) => slot?.isAvailable);
  for (const slot of slots) {
    const { startAbsoluteMinute, endAbsoluteMinute } = toAbsoluteInterval(
      slot.startTime,
      slot.endTime,
      toLocalClockFromUtcTime
    );

    if (rowDay === normalizedDayKey) {
      const sameDay = clipInterval(startAbsoluteMinute, endAbsoluteMinute, 0, DAY_MINUTES, 0);
      if (sameDay) intervals.push(sameDay);
    }

    if (rowDay === previousDayKey) {
      const carryOver = clipInterval(
        startAbsoluteMinute,
        endAbsoluteMinute,
        DAY_MINUTES,
        DAY_MINUTES * 2,
        -DAY_MINUTES
      );
      if (carryOver) intervals.push(carryOver);
    }
  }

  return intervals;
};

export const resolveAvailabilityIntervalsForDay = ({
  allEntries,
  dayKey,
  targetIds,
  normalizeId,
  toLocalClockFromUtcTime,
}: {
  allEntries: ApiDayAvailability[];
  dayKey: string;
  targetIds?: Set<string>;
  normalizeId: (value?: string) => string;
  toLocalClockFromUtcTime: (utcTime: string) => PreferredTimeZoneClock;
}): DropAvailabilityInterval[] => {
  if (!allEntries.length) return [];

  const normalizedDayKey = String(dayKey || '').toUpperCase();
  const previousDayKey = getPreviousWeekdayKey(normalizedDayKey);
  const sourceEntries = resolveSourceEntries(allEntries, targetIds, normalizeId);

  const intervals: DropAvailabilityInterval[] = [];
  for (const entry of sourceEntries) {
    intervals.push(
      ...collectIntervalsForEntry(entry, normalizedDayKey, previousDayKey, toLocalClockFromUtcTime)
    );
  }

  return mergeIntervals(intervals);
};
