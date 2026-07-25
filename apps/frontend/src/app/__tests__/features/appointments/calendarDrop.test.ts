import { calcNearestAvailableMinute } from '@/app/features/appointments/components/Calendar/calendarDrop';

describe('calcNearestAvailableMinute', () => {
  it('snaps to the nearest 5-minute mark within an interval', () => {
    const intervals = [{ startMinute: 0, endMinute: 60 }];
    expect(calcNearestAvailableMinute(22, intervals)).toBe(20);
  });

  it('clamps to the interval start when minute is before it but within tolerance', () => {
    const intervals = [{ startMinute: 30, endMinute: 60 }];
    expect(calcNearestAvailableMinute(25, intervals)).toBe(30);
  });

  it('clamps to the interval end when minute is after it but within tolerance', () => {
    const intervals = [{ startMinute: 0, endMinute: 30 }];
    expect(calcNearestAvailableMinute(35, intervals)).toBe(30);
  });

  it('picks the closest of multiple intervals', () => {
    const intervals = [
      { startMinute: 0, endMinute: 10 },
      { startMinute: 100, endMinute: 120 },
    ];
    expect(calcNearestAvailableMinute(95, intervals)).toBe(100);
  });

  it('returns null when no interval is within tolerance', () => {
    const intervals = [{ startMinute: 0, endMinute: 10 }];
    expect(calcNearestAvailableMinute(200, intervals)).toBeNull();
  });

  it('returns null when there are no intervals at all', () => {
    expect(calcNearestAvailableMinute(30, [])).toBeNull();
  });
});
