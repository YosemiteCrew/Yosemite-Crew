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

  describe('endHour clamping to day bounds', () => {
    it('clamps endHour when minVisibleHours pushes it past day end (23:00)', () => {
      // Late-day event at 22:30 with minVisibleHours=2 would naturally push endHour to 24+
      const result = getVisibleHourRange('in', [22 * 60 + 30], {
        endHour: 23,
        minVisibleHours: 2,
      });

      // Should clamp to 23, not exceed it
      expect(result.endHour).toBe(23);
      expect(result.endHour).toBeLessThanOrEqual(23);
    });

    it('clamps endHour when event is very close to day end', () => {
      // Event at 23:00 with minVisibleHours=3 would push endHour to 26+
      const result = getVisibleHourRange('in', [23 * 60], {
        endHour: 23,
        minVisibleHours: 3,
      });

      expect(result.endHour).toBe(23);
    });

    it('respects minVisibleHours when there is room before day end', () => {
      // Event at 19:00 with minVisibleHours=2 should give at least 2 hours
      const result = getVisibleHourRange('in', [19 * 60], {
        endHour: 23,
        startHour: 0,
        minVisibleHours: 2,
      });

      // startHour=19, minVisibleHours=2 → endHour should be at least 21
      expect(result.endHour).toBeGreaterThanOrEqual(result.startHour + 2);
      expect(result.endHour).toBeLessThanOrEqual(23);
    });

    it('does not exceed configured endHour limit', () => {
      // Multiple scenarios to ensure endHour never exceeds the configured max
      const testCases = [
        { minuteValues: [23 * 60], endHour: 23, minVisibleHours: 1 },
        { minuteValues: [22 * 60], endHour: 23, minVisibleHours: 2 },
        { minuteValues: [20 * 60], endHour: 23, minVisibleHours: 4 },
      ];

      testCases.forEach(({ minuteValues, endHour: configEndHour, minVisibleHours }) => {
        const result = getVisibleHourRange('in', minuteValues, {
          endHour: configEndHour,
          minVisibleHours,
        });

        expect(result.endHour).toBeLessThanOrEqual(configEndHour);
      });
    });

    it('maintains startHour at minimum when event is near end of day', () => {
      // Event at 23:00 with padding should result in startHour around 22
      const result = getVisibleHourRange('in', [23 * 60], {
        startHour: 0,
        endHour: 23,
        minVisibleHours: 2,
        paddingMinutes: 30,
      });

      // startHour should be computed based on the event (23:00) minus padding (30 mins = 0.5 hours)
      expect(result.startHour).toBe(22);
      // endHour should be clamped to 23
      expect(result.endHour).toBe(23);
    });
  });
});
