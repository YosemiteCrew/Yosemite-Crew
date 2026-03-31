import {
  formatDateLocal,
  formatDateUTC,
  getAgeInYears,
  buildUtcDateFromDateAndTime,
  getDurationMinutes,
  generateTimeSlots,
  applyUtcTime,
  getUtcTimeValue,
  getPreferredTimeValue,
  formatDisplayDate,
  formatDateTimeLocal,
  formatTimeInPreferredTimeZone,
  toUtcCalendarDate,
} from '@/app/lib/date';
import { setPreferredTimeZone } from '@/app/lib/timezone';

beforeEach(() => {
  window.localStorage.clear();
  setPreferredTimeZone('UTC');
});

describe('formatDateLocal', () => {
  it('formats a date to YYYY-MM-DD using local time', () => {
    // Use a fixed date with known local parts
    const date = new Date(2026, 2, 5); // March 5, 2026 local time
    const result = formatDateLocal(date);
    expect(result).toBe('2026-03-05');
  });
});

describe('formatDateUTC', () => {
  it('formats a UTC date to YYYY-MM-DD', () => {
    const date = new Date('2026-06-15T00:00:00.000Z');
    expect(formatDateUTC(date)).toBe('2026-06-15');
  });

  it('pads month and day with leading zeros', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    expect(formatDateUTC(date)).toBe('2026-01-01');
  });
});

describe('getAgeInYears', () => {
  it('calculates age correctly when birthday has already passed this year', () => {
    // Fix "today" via Date mock
    const realDate = Date;
    const mockToday = new Date('2026-03-30');
    jest.spyOn(global, 'Date').mockImplementation((arg?: any) => {
      if (arg === undefined) return mockToday as any;
      return new realDate(arg) as any;
    });
    (global.Date as any).now = realDate.now;

    expect(getAgeInYears('2000-01-01')).toBe(26);
    jest.restoreAllMocks();
  });

  it('reduces age by one when birthday has not occurred yet this year', () => {
    const realDate = Date;
    const mockToday = new Date('2026-03-30');
    jest.spyOn(global, 'Date').mockImplementation((arg?: any) => {
      if (arg === undefined) return mockToday as any;
      return new realDate(arg) as any;
    });
    (global.Date as any).now = realDate.now;

    expect(getAgeInYears('2000-12-31')).toBe(25);
    jest.restoreAllMocks();
  });
});

describe('buildUtcDateFromDateAndTime', () => {
  it('combines a date and HH:MM time string into a UTC Date', () => {
    const base = new Date('2026-03-05T00:00:00.000Z');
    const result = buildUtcDateFromDateAndTime(base, '09:30');
    expect(result.getUTCHours()).toBe(9);
    expect(result.getUTCMinutes()).toBe(30);
    expect(result.getUTCDate()).toBe(5);
  });

  it('handles midnight correctly', () => {
    const base = new Date('2026-03-05T00:00:00.000Z');
    const result = buildUtcDateFromDateAndTime(base, '00:00');
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
  });
});

describe('getDurationMinutes', () => {
  it('computes minutes between two HH:MM times', () => {
    expect(getDurationMinutes('09:00', '10:30')).toBe(90);
  });

  it('returns 0 for same start and end', () => {
    expect(getDurationMinutes('08:00', '08:00')).toBe(0);
  });

  it('returns negative for end before start', () => {
    expect(getDurationMinutes('10:00', '09:00')).toBe(-60);
  });
});

describe('generateTimeSlots', () => {
  it('generates 96 slots for default 15-minute interval', () => {
    const slots = generateTimeSlots(15);
    expect(slots.length).toBe(96);
  });

  it('generates 48 slots for 30-minute interval', () => {
    const slots = generateTimeSlots(30);
    expect(slots.length).toBe(48);
  });

  it('first slot is 00:00', () => {
    const slots = generateTimeSlots(15);
    expect(slots[0].value).toBe('00:00');
  });

  it('each slot has value and label', () => {
    const slots = generateTimeSlots(60);
    expect(slots[0]).toHaveProperty('value');
    expect(slots[0]).toHaveProperty('label');
  });
});

describe('applyUtcTime', () => {
  it('sets the UTC hours and minutes on a date', () => {
    const base = new Date('2026-03-05T00:00:00.000Z');
    const result = applyUtcTime(base, '14:45');
    expect(result.getUTCHours()).toBe(14);
    expect(result.getUTCMinutes()).toBe(45);
  });

  it('does not mutate the original date', () => {
    const base = new Date('2026-03-05T10:00:00.000Z');
    applyUtcTime(base, '00:00');
    expect(base.getUTCHours()).toBe(10);
  });
});

describe('getUtcTimeValue', () => {
  it('returns HH:MM from a UTC date', () => {
    const date = new Date('2026-03-05T08:05:00.000Z');
    expect(getUtcTimeValue(date)).toBe('08:05');
  });

  it('returns fallback for null', () => {
    expect(getUtcTimeValue(null)).toBe('00:00');
  });

  it('returns fallback for empty string', () => {
    expect(getUtcTimeValue('')).toBe('00:00');
  });

  it('uses custom fallback', () => {
    expect(getUtcTimeValue(undefined, '12:00')).toBe('12:00');
  });

  it('returns fallback for invalid date string', () => {
    expect(getUtcTimeValue('not-a-date')).toBe('00:00');
  });
});

describe('getPreferredTimeValue', () => {
  it('returns HH:MM in preferred timezone (UTC)', () => {
    const date = new Date('2026-03-05T09:15:00.000Z');
    expect(getPreferredTimeValue(date)).toBe('09:15');
  });

  it('returns fallback for null', () => {
    expect(getPreferredTimeValue(null)).toBe('00:00');
  });
});

describe('formatDisplayDate', () => {
  it('returns a formatted date string', () => {
    const result = formatDisplayDate(new Date('2026-03-05T00:00:00.000Z'));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns fallback for null', () => {
    expect(formatDisplayDate(null)).toBe('');
  });

  it('returns custom fallback for invalid date', () => {
    expect(formatDisplayDate('invalid', 'N/A')).toBe('N/A');
  });
});

describe('formatDateTimeLocal', () => {
  it('returns a date+time string', () => {
    const result = formatDateTimeLocal(new Date('2026-03-05T09:00:00.000Z'));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns "Not available" for null', () => {
    expect(formatDateTimeLocal(null)).toBe('Not available');
  });
});

describe('formatTimeInPreferredTimeZone', () => {
  it('returns a time string', () => {
    const result = formatTimeInPreferredTimeZone(new Date('2026-03-05T14:30:00.000Z'));
    expect(result).toContain('2:30');
  });

  it('returns fallback for null', () => {
    expect(formatTimeInPreferredTimeZone(null)).toBe('');
  });
});

describe('toUtcCalendarDate', () => {
  it('returns a local midnight Date corresponding to the UTC date', () => {
    const date = new Date('2026-06-15T23:00:00.000Z');
    const result = toUtcCalendarDate(date);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5); // June = 5
    expect(result.getDate()).toBe(15);
  });

  it('falls back to current date for null', () => {
    const result = toUtcCalendarDate(null);
    expect(result).toBeInstanceOf(Date);
  });

  it('falls back to current date for empty string', () => {
    const result = toUtcCalendarDate('');
    expect(result).toBeInstanceOf(Date);
  });
});
