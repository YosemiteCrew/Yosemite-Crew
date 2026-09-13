import {
  getWeekDaysInPreferredTimeZone,
  startOfPreferredTimeZoneDay,
} from '@/app/features/appointments/components/Calendar/weekHelpers';
import { getDateKeyInPreferredTimeZone, setPreferredTimeZone } from '@/app/lib/timezone';

// The preferred timezone falls back to Europe/Berlin when localStorage is empty,
// which makes every assertion below independent of the host machine's zone
// (see phoneMonthModel.test.ts, which establishes the same pattern).
beforeEach(() => {
  window.localStorage.clear();
});

describe('startOfPreferredTimeZoneDay (#1868)', () => {
  it('resolves to the preferred-zone calendar day even in a zone far ahead of UTC', () => {
    // Jan 14 12:00 UTC is already Jan 15 in Kiritimati (UTC+14, no DST).
    setPreferredTimeZone('Pacific/Kiritimati');
    const instant = new Date(Date.UTC(2026, 0, 14, 12, 0));

    const anchored = startOfPreferredTimeZoneDay(instant);

    expect(getDateKeyInPreferredTimeZone(anchored)).toBe('2026-01-15');
  });

  it('resolves to the preferred-zone calendar day even in a zone far behind UTC', () => {
    // Jan 15 09:00 UTC is still Jan 14 in Midway (UTC-11, no DST).
    setPreferredTimeZone('Pacific/Midway');
    const instant = new Date(Date.UTC(2026, 0, 15, 9, 0));

    const anchored = startOfPreferredTimeZoneDay(instant);

    expect(getDateKeyInPreferredTimeZone(anchored)).toBe('2026-01-14');
  });
});

describe('getWeekDaysInPreferredTimeZone (#1868)', () => {
  it('steps seven consecutive preferred-zone calendar days, not browser-local ones', () => {
    setPreferredTimeZone('Pacific/Kiritimati');
    // Preferred-zone calendar day is Jan 15 (see above).
    const weekStart = new Date(Date.UTC(2026, 0, 14, 12, 0));

    const days = getWeekDaysInPreferredTimeZone(weekStart);

    expect(days).toHaveLength(7);
    expect(days.map((day) => getDateKeyInPreferredTimeZone(day))).toEqual([
      '2026-01-15',
      '2026-01-16',
      '2026-01-17',
      '2026-01-18',
      '2026-01-19',
      '2026-01-20',
      '2026-01-21',
    ]);
  });

  it('rolls over month and year boundaries in the preferred zone', () => {
    setPreferredTimeZone('Pacific/Kiritimati');
    // Dec 30 12:00 UTC is already Dec 31 in Kiritimati.
    const weekStart = new Date(Date.UTC(2025, 11, 30, 12, 0));

    const days = getWeekDaysInPreferredTimeZone(weekStart);

    expect(days.map((day) => getDateKeyInPreferredTimeZone(day))).toEqual([
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
    ]);
  });
});
