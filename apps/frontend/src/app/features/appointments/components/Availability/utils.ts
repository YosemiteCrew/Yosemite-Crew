import { formatUtcClockTimeLabel, utcClockTimeToPreferredTimeZoneClock } from '@/app/lib/timezone';

export interface TimeOption {
  value: string;
  label: string;
}
export interface Interval {
  start: string;
  end: string;
}
export interface DayAvailability {
  enabled: boolean;
  intervals: Interval[];
}
export type AvailabilityState = Record<string, DayAvailability>;
export type SetAvailability = React.Dispatch<React.SetStateAction<AvailabilityState>>;

export const formatUtcTimeToLocalLabel = (value: string): string => {
  return formatUtcClockTimeLabel(value);
};

const parseClockValue = (value: string): number | null => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const formatClockValue = (minutes: number): string => {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Math.floor(minutes)));
  const hh = String(Math.floor(safe / 60)).padStart(2, '0');
  const mm = String(safe % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

const formatLocalClockTimeLabel = (value: string): string => {
  const totalMinutes = parseClockValue(value);
  if (totalMinutes == null) return value;
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
};

export const generateTimeOptions = (): TimeOption[] => {
  const options: TimeOption[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const hh = hour.toString().padStart(2, '0');
      const mm = min.toString().padStart(2, '0');
      const label = formatLocalClockTimeLabel(`${hh}:${mm}`);
      options.push({
        value: `${hh}:${mm}`,
        label,
      });
    }
  }
  options.push({ value: '23:59', label: formatLocalClockTimeLabel('23:59') });
  return options;
};

export const buildTimeIndex = (options: TimeOption[]): Map<string, number> =>
  new Map(options.map((opt, idx) => [opt.value, idx]));

export const timeOptions: TimeOption[] = generateTimeOptions();
export const timeIndex: Map<string, number> = buildTimeIndex(timeOptions);

export const getTimeLabelFromValue = (value: string): string => {
  return formatLocalClockTimeLabel(value);
};

export const daysOfWeek = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const DEFAULT_INTERVAL: Interval = { start: '09:00', end: '17:00' };

const DAY_MINUTES = 24 * 60;

const toDayIndex = (dayName: string): number => {
  const normalized = String(dayName || '')
    .trim()
    .toLowerCase();
  return daysOfWeek.findIndex((day) => day.toLowerCase() === normalized);
};

const toDayNameUpper = (dayIndex: number): string => {
  const normalized = ((dayIndex % 7) + 7) % 7;
  return daysOfWeek[normalized].toUpperCase();
};

const toIntervalSegmentsByDay = (
  startAbsoluteMinute: number,
  endAbsoluteMinute: number
): Array<{ dayOffset: number; startMinute: number; endMinute: number }> => {
  const segments: Array<{ dayOffset: number; startMinute: number; endMinute: number }> = [];
  const startDayOffset = Math.floor(startAbsoluteMinute / DAY_MINUTES);
  const endDayOffset = Math.floor((endAbsoluteMinute - 1) / DAY_MINUTES);
  for (let dayOffset = startDayOffset; dayOffset <= endDayOffset; dayOffset++) {
    const dayStart = dayOffset * DAY_MINUTES;
    const dayEnd = dayStart + DAY_MINUTES;
    const segmentStart = Math.max(startAbsoluteMinute, dayStart);
    const segmentEnd = Math.min(endAbsoluteMinute, dayEnd);
    if (segmentEnd <= segmentStart) continue;
    segments.push({
      dayOffset,
      startMinute: segmentStart - dayStart,
      endMinute: segmentEnd - dayStart,
    });
  }
  return segments;
};

const mergeIntervals = (intervals: Interval[]): Interval[] => {
  const normalized = intervals
    .map((interval) => {
      const start = parseClockValue(interval.start);
      const end = parseClockValue(interval.end);
      if (start == null || end == null || end <= start) return null;
      return { start, end };
    })
    .filter((interval): interval is { start: number; end: number } => interval != null)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (!normalized.length) return [];

  const merged: Array<{ start: number; end: number }> = [normalized[0]];
  for (let i = 1; i < normalized.length; i++) {
    const previous = merged[merged.length - 1];
    const current = normalized[i];
    if (current.start <= previous.end) {
      previous.end = Math.max(previous.end, current.end);
      continue;
    }
    merged.push({ ...current });
  }

  return merged.map((interval) => ({
    start: formatClockValue(interval.start),
    end: formatClockValue(interval.end),
  }));
};

const utcClockTimeToMinutes = (value: string): number | null => {
  const parsed = parseClockValue(value);
  return parsed == null ? null : parsed;
};

const localClockTimeToUtcClock = (
  localClockTime: string
): { minutes: number; dayOffset: number } => {
  const localMinutes = parseClockValue(localClockTime);
  if (localMinutes == null) return { minutes: 0, dayOffset: 0 };

  for (let utcMinute = 0; utcMinute < DAY_MINUTES; utcMinute++) {
    const utcClock = formatClockValue(utcMinute);
    const localClock = utcClockTimeToPreferredTimeZoneClock(utcClock);
    if (localClock.minutes !== localMinutes) continue;
    return {
      minutes: utcMinute,
      dayOffset: -localClock.dayOffset,
    };
  }

  return { minutes: localMinutes, dayOffset: 0 };
};

export type ApiAvailability = {
  availabilities: {
    dayOfWeek: string;
    slots: { startTime: string; endTime: string }[];
  }[];
};

export const convertAvailability = (availability: AvailabilityState): ApiAvailability => {
  const byDay = new Map<string, Array<{ startTime: string; endTime: string }>>();

  for (const [day, data] of Object.entries(availability)) {
    if (!data.enabled) continue;
    const localDayIndex = toDayIndex(day);
    if (localDayIndex < 0) continue;

    for (const interval of data.intervals) {
      const startLocal = parseClockValue(interval.start);
      const endLocalRaw = parseClockValue(interval.end);
      if (startLocal == null || endLocalRaw == null) continue;
      const endLocal = endLocalRaw <= startLocal ? endLocalRaw + DAY_MINUTES : endLocalRaw;

      const utcStartClock = localClockTimeToUtcClock(formatClockValue(startLocal));
      const utcEndClock = localClockTimeToUtcClock(formatClockValue(endLocalRaw));

      const utcStartAbsoluteMinute = utcStartClock.dayOffset * DAY_MINUTES + utcStartClock.minutes;
      let utcEndAbsoluteMinute = utcEndClock.dayOffset * DAY_MINUTES + utcEndClock.minutes;
      if (utcEndAbsoluteMinute <= utcStartAbsoluteMinute) {
        utcEndAbsoluteMinute += DAY_MINUTES;
      }

      const utcSegments = toIntervalSegmentsByDay(utcStartAbsoluteMinute, utcEndAbsoluteMinute);
      for (const segment of utcSegments) {
        const dayOfWeek = toDayNameUpper(localDayIndex + segment.dayOffset);
        if (!byDay.has(dayOfWeek)) byDay.set(dayOfWeek, []);
        byDay.get(dayOfWeek)?.push({
          startTime: formatClockValue(segment.startMinute),
          endTime: formatClockValue(segment.endMinute),
        });
      }
    }
  }

  const availabilities = Array.from(byDay.entries())
    .map(([dayOfWeek, slots]) => ({
      dayOfWeek,
      slots: mergeIntervals(
        slots.map((slot) => ({
          start: slot.startTime,
          end: slot.endTime,
        }))
      ).map((slot) => ({
        startTime: slot.start,
        endTime: slot.end,
      })),
    }))
    .filter((entry) => entry.slots.length > 0);

  return { availabilities };
};

export type ApiSlot = {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

export type ApiDayAvailability = {
  _id: string;
  userId?: string;
  organisationId: string;
  dayOfWeek: string;
  slots: ApiSlot[];
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
};

export type ApiOverridesSlot = {
  startTime: string;
  endTime: string;
  _id?: string;
};

export type ApiOverridesDay = {
  dayOfWeek: string;
  slots: ApiOverridesSlot[];
  _id?: string;
};

export type ApiOverrides = {
  _id: string;
  userId?: string;
  organisationId: string;
  weekStartDate: Date;
  dayOfWeek: string;
  overrides: ApiOverridesDay[];
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
};

export type GetAvailabilityResponse = {
  message?: string;
  data: ApiDayAvailability[];
};

export const convertFromGetApi = (apiData: ApiDayAvailability[]): AvailabilityState => {
  const hasAnyAvailableSlot = apiData.some((entry) =>
    entry.slots?.some((slot) => slot.isAvailable)
  );
  if (!hasAnyAvailableSlot) {
    return daysOfWeek.reduce<AvailabilityState>((acc, day) => {
      const isWeekday =
        day === 'Monday' ||
        day === 'Tuesday' ||
        day === 'Wednesday' ||
        day === 'Thursday' ||
        day === 'Friday';

      acc[day] = {
        enabled: isWeekday,
        intervals: [{ ...DEFAULT_INTERVAL }],
      };
      return acc;
    }, {} as AvailabilityState);
  }
  const result: AvailabilityState = {} as AvailabilityState;
  const localByDay = new Map<string, Interval[]>();

  for (const entry of apiData) {
    const utcDayIndex = toDayIndex(entry.dayOfWeek);
    if (utcDayIndex < 0) continue;
    const availableSlots = (entry.slots ?? []).filter((slot) => slot.isAvailable);

    for (const slot of availableSlots) {
      const startUtcMinute = utcClockTimeToMinutes(slot.startTime);
      const endUtcMinuteRaw = utcClockTimeToMinutes(slot.endTime);
      if (startUtcMinute == null || endUtcMinuteRaw == null) continue;

      const startLocalClock = utcClockTimeToPreferredTimeZoneClock(slot.startTime);
      const endLocalClock = utcClockTimeToPreferredTimeZoneClock(slot.endTime);

      const startLocalAbsoluteMinute =
        startLocalClock.dayOffset * DAY_MINUTES + startLocalClock.minutes;
      let endLocalAbsoluteMinute = endLocalClock.dayOffset * DAY_MINUTES + endLocalClock.minutes;

      if (endLocalAbsoluteMinute <= startLocalAbsoluteMinute) {
        endLocalAbsoluteMinute += DAY_MINUTES;
      }

      const localSegments = toIntervalSegmentsByDay(
        startLocalAbsoluteMinute,
        endLocalAbsoluteMinute
      );

      for (const segment of localSegments) {
        const localDayName = daysOfWeek[(((utcDayIndex + segment.dayOffset) % 7) + 7) % 7];
        if (!localByDay.has(localDayName)) localByDay.set(localDayName, []);
        localByDay.get(localDayName)?.push({
          start: formatClockValue(segment.startMinute),
          end: formatClockValue(segment.endMinute),
        });
      }
    }
  }

  for (const day of daysOfWeek) {
    const slots = mergeIntervals(localByDay.get(day) ?? []);
    if (!slots || slots.length === 0) {
      result[day] = {
        enabled: false,
        intervals: [{ ...DEFAULT_INTERVAL }],
      };
      continue;
    }
    result[day] = {
      enabled: true,
      intervals: slots,
    };
  }
  return result;
};

export const hasAtLeastOneAvailability = (converted: ApiAvailability): boolean => {
  return Array.isArray(converted.availabilities) && converted.availabilities.length > 0;
};
