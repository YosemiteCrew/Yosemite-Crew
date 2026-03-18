import {
  DEFAULT_TIMEZONE,
  TIMEZONE_STORAGE_KEY,
  buildDateInPreferredTimeZone,
  formatDateInPreferredTimeZone,
  formatUtcClockTimeLabel,
  getDateKeyInPreferredTimeZone,
  getDatePartsInPreferredTimeZone,
  getHourInPreferredTimeZone,
  getMinutesSinceStartOfDayInPreferredTimeZone,
  getPreciseMinutesSinceStartOfDayInPreferredTimeZone,
  getPreferredTimeZone,
  getTimezoneOptions,
  isOnPreferredTimeZoneCalendarDay,
  isValidTimeZone,
  resolveTimezoneFromCountry,
  setPreferredTimeZone,
  utcClockTimeToMinutesInPreferredTimeZone,
  utcClockTimeToPreferredTimeZoneClock,
} from '@/app/lib/timezone';

describe('timezone utils', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('validates timezone identifiers', () => {
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Invalid/Zone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('returns default timezone if nothing stored', () => {
    expect(getPreferredTimeZone()).toBe(DEFAULT_TIMEZONE);
  });

  it('sets and reads preferred timezone token', () => {
    const ok = setPreferredTimeZone('UTC');
    expect(ok).toBe(true);
    expect(window.localStorage.getItem(TIMEZONE_STORAGE_KEY)).not.toBeNull();
    expect(getPreferredTimeZone()).toBe('UTC');
  });

  it('rejects invalid timezone on set', () => {
    const ok = setPreferredTimeZone('Invalid/Zone');
    expect(ok).toBe(false);
  });

  it('builds timezone options list', () => {
    const options = getTimezoneOptions();
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((item) => item.value === 'UTC')).toBe(true);
  });

  it('resolves timezone by country', () => {
    expect(resolveTimezoneFromCountry('India')).toBe('Asia/Kolkata');
    expect(resolveTimezoneFromCountry('Unknownland')).toBeNull();
    expect(resolveTimezoneFromCountry('')).toBeNull();
  });

  it('formats utc clock labels and handles invalid input', () => {
    setPreferredTimeZone('UTC');
    expect(formatUtcClockTimeLabel('13:30')).toContain('1:30');
    expect(formatUtcClockTimeLabel('bad')).toBe('bad');
  });

  it('converts utc clock time to preferred timezone minutes', () => {
    setPreferredTimeZone('UTC');
    expect(utcClockTimeToMinutesInPreferredTimeZone('00:30')).toBe(30);
    expect(utcClockTimeToMinutesInPreferredTimeZone('invalid')).toBe(0);
  });

  it('converts utc clock to preferred clock structure', () => {
    setPreferredTimeZone('UTC');
    expect(utcClockTimeToPreferredTimeZoneClock('01:15')).toEqual({ minutes: 75, dayOffset: 0 });
    expect(utcClockTimeToPreferredTimeZoneClock('invalid')).toEqual({ minutes: 0, dayOffset: 0 });
  });

  it('formats and parses date parts in preferred timezone', () => {
    setPreferredTimeZone('UTC');
    const date = new Date('2026-01-02T03:04:05.000Z');
    const formatted = formatDateInPreferredTimeZone(date, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    expect(formatted).toContain('01/02/2026');

    const parts = getDatePartsInPreferredTimeZone(date);
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(1);
    expect(parts.day).toBe(2);
    expect(parts.hour).toBe(3);
    expect(parts.minute).toBe(4);
  });

  it('computes day keys and same-day matching', () => {
    setPreferredTimeZone('UTC');
    const a = new Date('2026-01-02T00:00:00.000Z');
    const b = new Date('2026-01-02T23:59:00.000Z');
    const c = new Date('2026-01-03T00:01:00.000Z');

    expect(getDateKeyInPreferredTimeZone(a)).toBe('2026-01-02');
    expect(isOnPreferredTimeZoneCalendarDay(b, a)).toBe(true);
    expect(isOnPreferredTimeZoneCalendarDay(c, a)).toBe(false);
  });

  it('computes minute and hour helpers', () => {
    setPreferredTimeZone('UTC');
    const date = new Date('2026-01-02T10:30:15.500Z');
    expect(getHourInPreferredTimeZone(date)).toBe(10);
    expect(getMinutesSinceStartOfDayInPreferredTimeZone(date)).toBe(630);
    expect(getPreciseMinutesSinceStartOfDayInPreferredTimeZone(date)).toBeCloseTo(630.2583, 3);
  });

  it('builds date in preferred timezone from day and minute', () => {
    setPreferredTimeZone('UTC');
    const date = buildDateInPreferredTimeZone(new Date('2026-01-02T00:00:00.000Z'), 90);
    const parts = getDatePartsInPreferredTimeZone(date);
    expect(parts.hour).toBe(1);
    expect(parts.minute).toBe(30);
  });
});
