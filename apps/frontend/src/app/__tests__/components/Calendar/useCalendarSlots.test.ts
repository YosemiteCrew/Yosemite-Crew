import {
  getTimedTaskProxyEvents,
  getUnavailableSegmentsForHourRange,
  getVisibleHourRange,
  getVisibleHours,
} from '@/app/features/appointments/components/Calendar/useCalendarSlots';

describe('useCalendarSlots helpers', () => {
  it('builds a bounded visible hour range from event and availability minutes', () => {
    expect(getVisibleHourRange('in', [9 * 60 + 15, 11 * 60 + 20])).toEqual({
      startHour: 8,
      endHour: 12,
    });
  });

  it('returns full-day hours when zoomed out', () => {
    expect(getVisibleHourRange('out', [9 * 60], { endHour: 23 })).toEqual({
      startHour: 0,
      endHour: 23,
    });
  });

  it('expands an hour range into visible hours', () => {
    expect(getVisibleHours({ startHour: 8, endHour: 10 })).toEqual([8, 9, 10]);
  });

  it('computes unavailable gaps for the visible hour range', () => {
    expect(
      getUnavailableSegmentsForHourRange(
        true,
        [
          { startMinute: 9 * 60, endMinute: 10 * 60 },
          { startMinute: 11 * 60, endMinute: 12 * 60 },
        ],
        { startHour: 8, endHour: 12 }
      )
    ).toEqual([
      { startMinute: 8 * 60, endMinute: 9 * 60 },
      { startMinute: 10 * 60, endMinute: 11 * 60 },
      { startMinute: 12 * 60, endMinute: 13 * 60 },
    ]);
  });

  it('creates timed proxy events for tasks', () => {
    const [event] = getTimedTaskProxyEvents([{ dueAt: '2026-04-04T09:30:00.000Z' }]);

    expect(event.startTime.toISOString()).toBe('2026-04-04T09:30:00.000Z');
    expect(event.endTime.toISOString()).toBe('2026-04-04T10:00:00.000Z');
  });
});
