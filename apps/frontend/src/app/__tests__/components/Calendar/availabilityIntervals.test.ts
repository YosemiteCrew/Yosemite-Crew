import {
  resolveAvailabilityIntervalsForDay,
  DropAvailabilityInterval,
} from '@/app/features/appointments/components/Calendar/availabilityIntervals';
import { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';
import { PreferredTimeZoneClock } from '@/app/lib/timezone';

const normalizeId = (value?: string) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const withDefaultAvailability = (
  entries: Array<
    Omit<ApiDayAvailability, '_id' | 'organisationId' | 'slots'> & {
      slots: Array<{ startTime: string; endTime: string }>;
    }
  >
): ApiDayAvailability[] =>
  entries.map((entry, index) => ({
    _id: `a-${index}`,
    organisationId: 'org-1',
    userId: entry.userId,
    dayOfWeek: entry.dayOfWeek,
    slots: entry.slots.map((slot) => ({ ...slot, isAvailable: true })),
  }));

const createClockConverter =
  (map: Record<string, PreferredTimeZoneClock>) =>
  (utcTime: string): PreferredTimeZoneClock =>
    map[utcTime] ?? { minutes: 0, dayOffset: 0 };

describe('resolveAvailabilityIntervalsForDay', () => {
  it('uses targeted user availability instead of org or other users', () => {
    const entries = withDefaultAvailability([
      { dayOfWeek: 'MONDAY', slots: [{ startTime: '09:00', endTime: '17:00' }] },
      { dayOfWeek: 'MONDAY', userId: 'user-a', slots: [{ startTime: '14:00', endTime: '20:00' }] },
      { dayOfWeek: 'MONDAY', userId: 'user-b', slots: [{ startTime: '01:00', endTime: '03:00' }] },
    ]);

    const clock = createClockConverter({
      '01:00': { minutes: 60, dayOffset: 0 },
      '03:00': { minutes: 180, dayOffset: 0 },
      '09:00': { minutes: 540, dayOffset: 0 },
      '14:00': { minutes: 840, dayOffset: 0 },
      '17:00': { minutes: 1020, dayOffset: 0 },
      '20:00': { minutes: 1200, dayOffset: 0 },
    });

    const result = resolveAvailabilityIntervalsForDay({
      allEntries: entries,
      dayKey: 'MONDAY',
      targetIds: new Set(['user-a']),
      normalizeId,
      toLocalClockFromUtcTime: clock,
    });

    expect(result).toEqual([{ startMinute: 840, endMinute: 1200 }]);
  });

  it('falls back to org availability when no user row matches target', () => {
    const entries = withDefaultAvailability([
      { dayOfWeek: 'MONDAY', slots: [{ startTime: '09:00', endTime: '17:00' }] },
      { dayOfWeek: 'MONDAY', userId: 'user-b', slots: [{ startTime: '14:00', endTime: '20:00' }] },
    ]);

    const clock = createClockConverter({
      '09:00': { minutes: 540, dayOffset: 0 },
      '14:00': { minutes: 840, dayOffset: 0 },
      '17:00': { minutes: 1020, dayOffset: 0 },
      '20:00': { minutes: 1200, dayOffset: 0 },
    });

    const result = resolveAvailabilityIntervalsForDay({
      allEntries: entries,
      dayKey: 'MONDAY',
      targetIds: new Set(['user-a']),
      normalizeId,
      toLocalClockFromUtcTime: clock,
    });

    expect(result).toEqual([{ startMinute: 540, endMinute: 1020 }]);
  });

  it('does not merge all user availabilities when no target is provided', () => {
    const entries = withDefaultAvailability([
      { dayOfWeek: 'MONDAY', slots: [{ startTime: '09:00', endTime: '17:00' }] },
      { dayOfWeek: 'MONDAY', userId: 'user-a', slots: [{ startTime: '18:00', endTime: '20:00' }] },
    ]);

    const clock = createClockConverter({
      '09:00': { minutes: 540, dayOffset: 0 },
      '17:00': { minutes: 1020, dayOffset: 0 },
      '18:00': { minutes: 1080, dayOffset: 0 },
      '20:00': { minutes: 1200, dayOffset: 0 },
    });

    const result = resolveAvailabilityIntervalsForDay({
      allEntries: entries,
      dayKey: 'MONDAY',
      normalizeId,
      toLocalClockFromUtcTime: clock,
    });

    expect(result).toEqual([{ startMinute: 540, endMinute: 1020 }]);
  });

  it('projects previous-day overnight availability into the current day', () => {
    const entries = withDefaultAvailability([
      { dayOfWeek: 'MONDAY', userId: 'user-a', slots: [{ startTime: '21:00', endTime: '05:00' }] },
    ]);

    const clock = createClockConverter({
      '21:00': { minutes: 1260, dayOffset: 0 },
      '05:00': { minutes: 300, dayOffset: 1 },
    });

    const tuesdayResult = resolveAvailabilityIntervalsForDay({
      allEntries: entries,
      dayKey: 'TUESDAY',
      targetIds: new Set(['user-a']),
      normalizeId,
      toLocalClockFromUtcTime: clock,
    });

    const mondayResult = resolveAvailabilityIntervalsForDay({
      allEntries: entries,
      dayKey: 'MONDAY',
      targetIds: new Set(['user-a']),
      normalizeId,
      toLocalClockFromUtcTime: clock,
    });

    expect(tuesdayResult).toEqual<DropAvailabilityInterval[]>([{ startMinute: 0, endMinute: 300 }]);
    expect(mondayResult).toEqual<DropAvailabilityInterval[]>([
      { startMinute: 1260, endMinute: 1440 },
    ]);
  });
});
