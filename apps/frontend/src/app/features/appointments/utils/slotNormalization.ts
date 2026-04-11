import { Slot } from '@/app/features/appointments/types/appointments';
import {
  buildDateInPreferredTimeZone,
  PreferredTimeZoneClock,
  utcClockTimeToPreferredTimeZoneClock,
} from '@/app/lib/timezone';

const DAY_MINUTES = 24 * 60;

export type SlotBatch = {
  dayShift: number;
  slots: Slot[];
};

export type NormalizedSlotMeta = {
  localStartMinute: number;
  localEndMinute: number;
};

export type NormalizedSlotEntry = {
  slot: Slot;
  meta: NormalizedSlotMeta;
};

const toAbsoluteLocalInterval = (
  slot: Slot,
  toLocalClockFromUtcTime: (utcTime: string) => PreferredTimeZoneClock
) => {
  const startClock = toLocalClockFromUtcTime(slot.startTime);
  const endClock = toLocalClockFromUtcTime(slot.endTime);

  const startAbsoluteMinute = startClock.dayOffset * DAY_MINUTES + startClock.minutes;
  let endAbsoluteMinute = endClock.dayOffset * DAY_MINUTES + endClock.minutes;
  if (endAbsoluteMinute <= startAbsoluteMinute) {
    endAbsoluteMinute += DAY_MINUTES;
  }

  return { startAbsoluteMinute, endAbsoluteMinute };
};

const toMinutesInDayRange = (value: number): number => {
  return ((value % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const normalizeSlotsForSelectedDay = (
  batches: SlotBatch[],
  toLocalClockFromUtcTime: (
    utcTime: string
  ) => PreferredTimeZoneClock = utcClockTimeToPreferredTimeZoneClock
): NormalizedSlotEntry[] => {
  const byLocalWindow = new Map<
    string,
    { slot: Slot; meta: NormalizedSlotMeta; vetIdSet: Set<string> }
  >();

  for (const batch of batches) {
    for (const slot of batch.slots) {
      const { startAbsoluteMinute, endAbsoluteMinute } = toAbsoluteLocalInterval(
        slot,
        toLocalClockFromUtcTime
      );
      const localStartMinute = startAbsoluteMinute + batch.dayShift * DAY_MINUTES;
      const localEndMinute = endAbsoluteMinute + batch.dayShift * DAY_MINUTES;

      if (localStartMinute < 0 || localStartMinute >= DAY_MINUTES) {
        continue;
      }

      const key = `${localStartMinute}-${localEndMinute}`;
      const existing = byLocalWindow.get(key);
      if (!existing) {
        byLocalWindow.set(key, {
          slot: {
            startTime: slot.startTime,
            endTime: slot.endTime,
            vetIds: [...(slot.vetIds ?? [])],
          },
          meta: { localStartMinute, localEndMinute },
          vetIdSet: new Set(slot.vetIds ?? []),
        });
        continue;
      }

      for (const vetId of slot.vetIds ?? []) {
        existing.vetIdSet.add(vetId);
      }
    }
  }

  return Array.from(byLocalWindow.values())
    .map((entry) => ({
      slot: {
        ...entry.slot,
        vetIds: Array.from(entry.vetIdSet),
      },
      meta: entry.meta,
    }))
    .sort((a, b) => {
      if (a.meta.localStartMinute !== b.meta.localStartMinute) {
        return a.meta.localStartMinute - b.meta.localStartMinute;
      }
      return a.meta.localEndMinute - b.meta.localEndMinute;
    });
};

export const resolveSlotDateTimesForSelectedDay = (
  selectedDate: Date,
  slotMeta: NormalizedSlotMeta,
  buildDate: (calendarDay: Date, minuteOfDay: number) => Date = buildDateInPreferredTimeZone
): { startTime: Date; endTime: Date; durationMinutes: number } => {
  const startMinute = toMinutesInDayRange(slotMeta.localStartMinute);
  const endDayOffset = Math.floor(slotMeta.localEndMinute / DAY_MINUTES);
  const endMinute = toMinutesInDayRange(slotMeta.localEndMinute);

  const startTime = buildDate(selectedDate, startMinute);
  const endTime = buildDate(addDays(selectedDate, endDayOffset), endMinute);

  return {
    startTime,
    endTime,
    durationMinutes: Math.max(0, slotMeta.localEndMinute - slotMeta.localStartMinute),
  };
};
