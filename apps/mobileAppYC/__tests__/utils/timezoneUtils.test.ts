import {
  convertUtcToLocalDateTime,
  getAppointmentTimeAsIso,
  getLocalDateFromUtc,
  isAppointmentToday,
  getAppointmentDisplayTime,
  formatAppointmentTimeWithDate,
} from '../../src/shared/utils/timezoneUtils';

describe('timezoneUtils', () => {
  // Save original console.warn to restore later
  const originalWarn = console.warn;

  beforeAll(() => {
    // Mock console.warn to keep test output clean during invalid date tests
    console.warn = jest.fn();

    // Freeze system time to a specific date for consistent relative checks (e.g. "Today")
    // Mocking "now" as 2023-10-15T12:00:00 local time
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-10-15T12:00:00'));
  });

  afterAll(() => {
    jest.useRealTimers();
    console.warn = originalWarn;
  });

  describe('convertUtcToLocalDateTime', () => {
    it('correctly converts valid UTC date and time string to a Date object', () => {
      const date = '2023-10-15';
      const time = '14:30'; // 2:30 PM UTC

      const result = convertUtcToLocalDateTime(date, time);

      // We verify the timestamp because it is timezone agnostic
      // 2023-10-15T14:30:00Z
      expect(result.toISOString()).toBe('2023-10-15T14:30:00.000Z');
    });

    it('handles seconds in time string correctly', () => {
      const date = '2023-10-15';
      const time = '14:30:45';
      const result = convertUtcToLocalDateTime(date, time);
      expect(result.toISOString()).toBe('2023-10-15T14:30:45.000Z');
    });

    it('returns current date and warns on invalid date string', () => {
      const invalidDate = 'invalid-date';
      const time = '14:30';

      const result = convertUtcToLocalDateTime(invalidDate, time);

      // Should default to "now" (which is mocked to 2023-10-15T12:00:00)
      expect(result.getTime()).toBe(Date.now());
      expect(console.warn).toHaveBeenCalledWith(
        '[Timezone] Invalid date/time:',
        { utcDate: invalidDate, utcTime: time }
      );
    });
  });

  describe('getAppointmentTimeAsIso', () => {
    it('formats date and HH:MM time into ISO UTC string', () => {
      expect(getAppointmentTimeAsIso('2023-10-15', '14:30')).toBe('2023-10-15T14:30:00Z');
    });

    it('formats date and HH:MM:SS time into ISO UTC string', () => {
      expect(getAppointmentTimeAsIso('2023-10-15', '14:30:15')).toBe('2023-10-15T14:30:15Z');
    });
  });

  describe('getLocalDateFromUtc', () => {
    it('creates a Date object from UTC date string at midnight', () => {
      const result = getLocalDateFromUtc('2023-10-15');
      expect(result.toISOString()).toBe('2023-10-15T00:00:00.000Z');
    });

    it('returns current date and warns on invalid input', () => {
      const result = getLocalDateFromUtc('not-a-date');
      expect(result.getTime()).toBe(Date.now());
      expect(console.warn).toHaveBeenCalledWith('[Timezone] Invalid date:', 'not-a-date');
    });
  });

  describe('isAppointmentToday', () => {
    // Current System Mock Time: 2023-10-15

    it('returns true if the UTC date matches today (local)', () => {
      // Assuming the input is meant to be interpreted as a UTC date that
      // resolves to the same calendar day relative to the "now" check.
      // Since `getLocalDateFromUtc` creates a UTC midnight date:
      // If "today" is Oct 15, passing '2023-10-15' creates Oct 15 UTC.

      // Note: This utility checks exact date parts (Year/Month/Date) against "new Date()".
      // Since we froze time, we can match it exactly.
      expect(isAppointmentToday('2023-10-15')).toBe(true);
    });

    it('returns false if the date is in the past', () => {
      expect(isAppointmentToday('2023-10-14')).toBe(false);
    });

    it('returns false if the date is in the future', () => {
      expect(isAppointmentToday('2023-10-16')).toBe(false);
    });

    it('returns false if the month is different', () => {
      expect(isAppointmentToday('2023-11-15')).toBe(false);
    });

    it('returns false if the year is different', () => {
      expect(isAppointmentToday('2024-10-15')).toBe(false);
    });
  });

  describe('getAppointmentDisplayTime', () => {
    it('formats UTC time to local 12-hour format string', () => {
      // Input: 14:00 UTC
      // To test strictly without timezone flakiness, we can rely on toLocaleTimeString behavior.
      // Since the test environment timezone might vary (CI vs Local),
      // we check that it calls toLocaleTimeString with correct options.

      const spy = jest.spyOn(Date.prototype, 'toLocaleTimeString');

      getAppointmentDisplayTime('2023-10-15', '14:00');

      expect(spy).toHaveBeenCalledWith('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      spy.mockRestore();
    });
  });

  describe('formatAppointmentTimeWithDate', () => {
    // Current System Mock Time: 2023-10-15

    it('returns "Today at [Time]" if the date matches today', () => {
      const utcDate = '2023-10-15';
      const utcTime = '10:00'; // arbitrary time

      // We verify the string starts with "Today at"
      const result = formatAppointmentTimeWithDate(utcDate, utcTime);
      expect(result).toMatch(/^Today at/);
    });

    it('returns "MMM DD, YYYY at [Time]" if date is NOT today', () => {
      const utcDate = '2023-12-25'; // Christmas
      const utcTime = '08:30';

      const result = formatAppointmentTimeWithDate(utcDate, utcTime);

      // Expected format: "Dec 25, 2023 at ..." (exact format depends on locale implementation in node)
      // We check broadly for the date parts
      expect(result).toContain('Dec');
      expect(result).toContain('25');
      expect(result).toContain('2023');
      expect(result).toContain('at');
      expect(result).not.toContain('Today');
    });

    it('handles different years correctly', () => {
      const utcDate = '2024-01-01';
      const utcTime = '00:00';
      const result = formatAppointmentTimeWithDate(utcDate, utcTime);
      expect(result).toContain('2024');
    });
  });
});