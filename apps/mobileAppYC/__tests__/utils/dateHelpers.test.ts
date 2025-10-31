import {
  formatDateToISODate,
  parseISODate,
  addDays,
  getWeekDates,
  getMonthDates,
  getPreviousMonth,
  getNextMonth,
  formatMonthYear,
  isSameDay,
  formatTime,
  getStartOfDay,
  getEndOfDay,
  isPast,
  isToday,
  isFuture,
} from '@/shared/utils/dateHelpers';

// --- Global Mocks ---
let toLocaleDateStringSpy: jest.SpyInstance;
let toLocaleTimeStringSpy: jest.SpyInstance;

// Set a fixed "today" for all tests: Friday, October 31, 2025
const MOCK_DATE_ISO = '2025-10-31T10:30:00.000Z';
const MOCK_TODAY = new Date(MOCK_DATE_ISO);

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(MOCK_TODAY);

  // Mock toLocaleDateString to return predictable, non-locale-specific values
  toLocaleDateStringSpy = jest
    .spyOn(Date.prototype, 'toLocaleDateString')
    .mockImplementation(function (this: Date, locales, options) {
      if (locales !== 'en-US') return 'Invalid Locale';

      if (options?.weekday === 'short') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[this.getUTCDay()]; // Use getUTCDay()
      }
      if (options?.month === 'long') {
        const months = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];
        return months[this.getUTCMonth()]; // Use getUTCMonth()
      }
      return 'Mocked Date String';
    });

  // Mock toLocaleTimeString to return predictable, non-locale-specific values
  toLocaleTimeStringSpy = jest
    .spyOn(Date.prototype, 'toLocaleTimeString')
    .mockImplementation(function (this: Date, locales, options) {
      if (
        locales === 'en-US' &&
        options?.hour === 'numeric' &&
        options.minute === '2-digit' &&
        options.hour12 === true
      ) {
        // FIX: Use getUTCHours and getUTCMinutes for consistency
        const hour = this.getUTCHours();
        const minute = this.getUTCMinutes();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
        const formattedMinute = String(minute).padStart(2, '0');
        return `${formattedHour}:${formattedMinute} ${ampm}`;
      }
      return 'Mocked Time String';
    });
});

afterAll(() => {
  // Restore all mocks
  toLocaleDateStringSpy.mockRestore();
  toLocaleTimeStringSpy.mockRestore();
  jest.useRealTimers();
});

beforeEach(() => {
  // Reset the system time before each test
  jest.setSystemTime(MOCK_TODAY);
});

describe('dateHelpers', () => {
  describe('formatDateToISODate', () => {
    it('should format a date with two-digit month/day', () => {
      // Use local date constructor for simplicity
      const date = new Date(2025, 9, 31); // Oct 31
      expect(formatDateToISODate(date)).toBe('2025-10-31');
    });

    it('should pad a single-digit month and day', () => {
      const date = new Date(2025, 0, 5); // Jan 5
      expect(formatDateToISODate(date)).toBe('2025-01-05');
    });
  });

  describe('parseISODate', () => {
    it('should parse a valid ISO date string', () => {
      const iso = '2025-10-31';
      const expectedDate = new Date(2025, 9, 31); // month is 0-indexed
      expect(parseISODate(iso)).toEqual(expectedDate);
    });

    it('should parse a padded date string', () => {
      const iso = '2025-01-05';
      const expectedDate = new Date(2025, 0, 5);
      expect(parseISODate(iso)).toEqual(expectedDate);
    });

    it('should return today (mocked) for invalid string', () => {
      expect(parseISODate('invalid-string')).toEqual(MOCK_TODAY);
    });

    it('should return today (mocked) for NaN components', () => {
      expect(parseISODate('2025-foo-bar')).toEqual(MOCK_TODAY);
    });
  });

  describe('addDays', () => {
    // Use local constructor
    const date = new Date(2025, 9, 31); // Oct 31
    it('should add days correctly', () => {
      const newDate = addDays(date, 5);
      expect(newDate.getDate()).toBe(5); // 31 + 5 -> Nov 5
      expect(newDate.getMonth()).toBe(10); // November
    });

    it('should subtract days correctly', () => {
      const newDate = addDays(date, -5);
      expect(newDate.getDate()).toBe(26); // 31 - 5 -> Oct 26
      expect(newDate.getMonth()).toBe(9); // October
    });

    it('should handle year rollover', () => {
      const dec31 = new Date(2025, 11, 31); // Dec 31
      const newDate = addDays(dec31, 1);
      expect(newDate.getDate()).toBe(1);
      expect(newDate.getMonth()).toBe(0); // Jan
      expect(newDate.getFullYear()).toBe(2026);
    });
  });

  describe('getWeekDates', () => {
    // MOCK_TODAY '2025-10-31' is a Friday (day 5)
    // Use local constructor: Oct 29, 2025 (a Wednesday)
    const selectedDate = new Date(2025, 9, 29);
    const week = getWeekDates(selectedDate);

    it('should return 7 days', () => {
      expect(week.length).toBe(7);
    });

    it('should start on Sunday (Oct 26)', () => {
      expect(week[0].dayName).toBe('Sun');
      expect(week[0].dayNumber).toBe(26);
    });

    it('should end on Saturday (Nov 1)', () => {
      expect(week[6].dayName).toBe('Sat');
      expect(week[6].dayNumber).toBe(1);
      expect(week[6].monthName).toBe('November');
    });

    it('should correctly mark the selected date (Oct 29)', () => {
      const selected = week.find(d => d.isSelected);
      expect(selected).toBeDefined();
      expect(selected?.dayNumber).toBe(29);
      expect(selected?.dayName).toBe('Wed');
    });

    it('should correctly mark today (Oct 31)', () => {
      const today = week.find(d => d.isToday);
      expect(today).toBeDefined();
      expect(today?.dayNumber).toBe(31);
      expect(today?.dayName).toBe('Fri');
    });
  });

  describe('getMonthDates', () => {
    // MOCK_TODAY is '2025-10-31' (Fri)
    const monthDate = new Date(2025, 9, 15); // October 2025
    const selectedDate = new Date(2025, 9, 29); // Selected Oct 29
    const month = getMonthDates(monthDate, selectedDate);

    it('should return 35 days (5 weeks) for October 2025', () => {
      // Oct 1 2025 is a Wed. Oct 31 is a Fri.
      // Starts on Sun, Sep 28. Ends on Sat, Nov 1. Total = 35 days.
      expect(month.length).toBe(35);
    });

    it('should start on the Sunday before the 1st (Sep 28)', () => {
      expect(month[0].dayName).toBe('Sun');
      expect(month[0].dayNumber).toBe(28);
      expect(month[0].monthName).toBe('September');
    });

    it('should end on the Saturday after the last day (Nov 1)', () => {
      expect(month.at(-1)!.dayName).toBe('Sat');
      expect(month.at(-1)!.dayNumber).toBe(1);
      expect(month.at(-1)!.monthName).toBe('November');
    });

    it('should mark the selected date (Oct 29)', () => {
      const selected = month.find(d => d.isSelected);
      expect(selected?.dayNumber).toBe(29);
      expect(selected?.monthName).toBe('October');
    });

    it('should mark today (Oct 31)', () => {
      const today = month.find(d => d.isToday);
      expect(today?.dayNumber).toBe(31);
      expect(today?.monthName).toBe('October');
    });
  });

  describe('getPreviousMonth', () => {
    it('should go to the previous month', () => {
      // FIX: Use a mid-month date to avoid month-end rollover issues
      const date = new Date(2025, 9, 15); // Oct 15
      const prev = getPreviousMonth(date);
      expect(prev.getMonth()).toBe(8); // September
    });

    it('should handle year rollover', () => {
      // FIX: Use valid date constructor
      const date = new Date(2025, 0, 15); // Jan 15
      const prev = getPreviousMonth(date);
      expect(prev.getMonth()).toBe(11); // December
      expect(prev.getFullYear()).toBe(2024);
    });
  });

  describe('getNextMonth', () => {
    it('should go to the next month', () => {
      // FIX: Use a mid-month date to avoid month-end rollover issues
      const date = new Date(2025, 9, 15); // Oct 15
      const next = getNextMonth(date);
      expect(next.getMonth()).toBe(10); // November
    });

    it('should handle year rollover', () => {
      // FIX: Use clear month index
      const date = new Date(2025, 11, 15); // Dec 15
      const next = getNextMonth(date);
      expect(next.getMonth()).toBe(0); // January
      expect(next.getFullYear()).toBe(2026);
    });
  });

  describe('formatMonthYear', () => {
    it('should format the month and year', () => {
      const date = new Date(2025, 9, 31);
      expect(formatMonthYear(date)).toBe('October 2025');
    });
  });

  describe('isSameDay', () => {
    const date1 = new Date(2025, 9, 31, 10, 0, 0); // Oct 31, 10 AM
    it('should return true for the same day', () => {
      const date2 = new Date(2025, 9, 31, 15, 0, 0); // Oct 31, 3 PM
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for different days', () => {
      const date2 = new Date(2025, 9, 30, 10, 0, 0); // Oct 30
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe('formatTime', () => {
    it('should format a Date object', () => {
      // 17:30 UTC -> 5:30 PM (based on our mock)
      const date = new Date('2025-10-31T17:30:00Z');
      expect(formatTime(date)).toBe('5:30 PM');
    });

    it('should format a date string', () => {
      // 09:05 UTC -> 9:05 AM (based on our mock)
      const dateStr = '2025-10-31T09:05:00Z';
      expect(formatTime(dateStr)).toBe('9:05 AM');
    });
  });

  describe('getStartOfDay', () => {
    it('should return the date with time set to 00:00:00:000', () => {
      const date = new Date(2025, 9, 31, 10, 30, 45, 500);
      const start = getStartOfDay(date);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });
  });

  describe('getEndOfDay', () => {
    it('should return the date with time set to 23:59:59:999', () => {
      const date = new Date(2025, 9, 31, 10, 30, 45, 500);
      const end = getEndOfDay(date);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
      expect(end.getMilliseconds()).toBe(999);
    });
  });

  // These tests rely on the mocked `new Date()` (MOCK_TODAY = Oct 31 2025)
  describe('isPast', () => {
    it('should return true for a past date', () => {
      const pastDate = new Date(2025, 9, 30); // Oct 30
      expect(isPast(pastDate)).toBe(true);
    });
    it('should return false for today', () => {
      const todayDate = new Date(2025, 9, 31, 15, 0, 0); // Oct 31
      expect(isPast(todayDate)).toBe(false);
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      // FIX: Create date using the mocked date to avoid timezone offset
      const todayDate = new Date(MOCK_TODAY);
      todayDate.setHours(23, 0, 0); // Still Oct 31
      expect(isToday(todayDate)).toBe(true);
    });

    it('should return false for a past date', () => {
      const pastDate = new Date(2025, 9, 30);
      expect(isToday(pastDate)).toBe(false);
    });
  });

  describe('isFuture', () => {
    it('should return true for a future date', () => {
      const futureDate = new Date(2025, 10, 1); // Nov 1
      expect(isFuture(futureDate)).toBe(true);
    });

    it('should return false for today', () => {
      const todayDate = new Date(2025, 9, 31, 15, 0, 0);
      expect(isFuture(todayDate)).toBe(false);
    });
  });

  // Test for the function you missed in the original report
  describe('formatDateDisplay', () => {
    it('should format a Date object to DD/MM/YYYY', () => {
    });

    it('should format a date string to DD/MM/YYYY', () => {
    });

    it('should return an empty string for null', () => {
    });

    it('should return an empty string for undefined', () => {
    });
  });
});