import { Slot } from '@/app/features/appointments/types/appointments';
import {
  normalizeSlotsForSelectedDay,
  resolveSlotDateTimesForSelectedDay,
} from '@/app/features/appointments/utils/slotNormalization';

describe('slotNormalization', () => {
  const toLocalClock = (value: string) => {
    const map: Record<string, { minutes: number; dayOffset: number }> = {
      '09:00': { minutes: 540, dayOffset: 0 },
      '09:15': { minutes: 555, dayOffset: 0 },
      '23:45': { minutes: 1425, dayOffset: 0 },
      '00:00': { minutes: 0, dayOffset: 1 },
      '00:15': { minutes: 15, dayOffset: 1 },
    };
    return map[value] ?? { minutes: 0, dayOffset: 0 };
  };

  it('keeps only slots that start on the selected local day and includes previous-day carryover', () => {
    const selectedDaySlots: Slot[] = [
      { startTime: '09:00', endTime: '09:15', vetIds: ['vet-a'] },
      { startTime: '23:45', endTime: '00:00', vetIds: ['vet-a'] },
      { startTime: '00:00', endTime: '00:15', vetIds: ['vet-a'] },
    ];
    const previousDaySlots: Slot[] = [{ startTime: '00:00', endTime: '00:15', vetIds: ['vet-b'] }];

    const normalized = normalizeSlotsForSelectedDay(
      [
        { dayShift: -1, slots: previousDaySlots },
        { dayShift: 0, slots: selectedDaySlots },
      ],
      toLocalClock
    );

    expect(normalized.map((entry) => entry.meta.localStartMinute)).toEqual([0, 540, 1425]);
    expect(normalized.map((entry) => entry.slot.startTime)).toEqual(['00:00', '09:00', '23:45']);
  });

  it('deduplicates the same local slot window and merges vet IDs', () => {
    const firstBatch: Slot[] = [{ startTime: '00:00', endTime: '00:15', vetIds: ['vet-a'] }];
    const secondBatch: Slot[] = [{ startTime: '00:00', endTime: '00:15', vetIds: ['vet-b'] }];

    const normalized = normalizeSlotsForSelectedDay(
      [
        { dayShift: -1, slots: firstBatch },
        { dayShift: -1, slots: secondBatch },
      ],
      toLocalClock
    );

    expect(normalized).toHaveLength(1);
    expect(normalized[0].meta).toEqual({ localStartMinute: 0, localEndMinute: 15 });
    expect(new Set(normalized[0].slot.vetIds)).toEqual(new Set(['vet-a', 'vet-b']));
  });

  it('resolves start/end datetime and duration for cross-midnight slot metadata', () => {
    const selectedDate = new Date('2026-03-28T00:00:00.000Z');
    const buildDate = (calendarDay: Date, minuteOfDay: number) => {
      const year = calendarDay.getUTCFullYear();
      const month = calendarDay.getUTCMonth();
      const day = calendarDay.getUTCDate();
      const hour = Math.floor(minuteOfDay / 60);
      const minute = minuteOfDay % 60;
      return new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
    };

    const resolved = resolveSlotDateTimesForSelectedDay(
      selectedDate,
      { localStartMinute: 1410, localEndMinute: 1455 },
      buildDate
    );

    expect(resolved.startTime.toISOString()).toBe('2026-03-28T23:30:00.000Z');
    expect(resolved.endTime.toISOString()).toBe('2026-03-29T00:15:00.000Z');
    expect(resolved.durationMinutes).toBe(45);
  });
});
