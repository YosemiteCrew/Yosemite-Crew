import type * as AvailabilityModule from '@/features/appointments/utils/availability';

// --- Global Mock References ---
// Define these outside to persist across jest.resetModules()
const mockAddDays = jest.fn();
const mockFormatDateToISODate = jest.fn();
const mockParseISODate = jest.fn();

// --- Module Mocks ---
jest.mock('@/shared/utils/dateHelpers', () => ({
  addDays: mockAddDays,
  formatDateToISODate: mockFormatDateToISODate,
  parseISODate: mockParseISODate,
}));

describe('availability utils', () => {
  const mockToday = '2023-10-01';
  let availabilityUtils: typeof AvailabilityModule;
  let originalDateTimeFormat: any;

  beforeAll(() => {
    // 1. Mock Intl.DateTimeFormat to force UTC timezone
    // This ensures deviceTimeZone in availability.ts initializes to 'UTC'
    originalDateTimeFormat = Intl.DateTimeFormat;
    const MockDateTimeFormat = jest.fn((locale, options) => {
      const newOptions = { ...options, timeZone: 'UTC' };
      return new originalDateTimeFormat(locale, newOptions);
    });
    (MockDateTimeFormat as any).supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf;
    (MockDateTimeFormat as any).resolvedOptions = () => ({ timeZone: 'UTC' });

    // @ts-ignore
    globalThis.Intl.DateTimeFormat = MockDateTimeFormat;

    // 2. Reset modules to force re-execution of availability.ts with the new Intl mock
    jest.resetModules();

    // 3. Require the module under test
    // We do this ONCE in beforeAll so we don't have to manage mock references repeatedly
    availabilityUtils = require('../../../../src/features/appointments/utils/availability');
  });

  afterAll(() => {
    globalThis.Intl.DateTimeFormat = originalDateTimeFormat;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // 4. Configure the persistent mock references
    mockParseISODate.mockImplementation((date: string) => {
      if (date === 'invalid') return new Date('Invalid Date');
      // Treat input as UTC midnight
      return new Date(`${date}T00:00:00Z`);
    });

    mockFormatDateToISODate.mockImplementation((date: Date) => {
      if (!date || Number.isNaN(date.getTime())) return 'invalid';
      return date.toISOString().split('T')[0];
    });

    mockAddDays.mockImplementation((date: Date, days: number) => {
      const result = new Date(date);
      if (Number.isNaN(result.getTime())) return result;
      result.setUTCDate(result.getUTCDate() + days);
      return result;
    });
  });

  // --- Tests ---

  // --- 1. getFirstAvailableDate ---
  describe('getFirstAvailableDate', () => {
    it('returns fallback or today if availability is missing', () => {
      expect(availabilityUtils.getFirstAvailableDate(null, mockToday)).toBe(mockToday);
      expect(availabilityUtils.getFirstAvailableDate(undefined, mockToday, 'fallback')).toBe('fallback');
    });

    it('returns the first date that has available slots on or after today', () => {
      const availability = {
        slotsByDate: {
          '2023-09-30': [{ isAvailable: true }], // Past
          '2023-10-05': [{ isAvailable: false }], // Future but unavailable
          '2023-10-03': [{ isAvailable: true }], // Target match
          '2023-10-04': [{ isAvailable: true }], // Later match
        },
      } as any;

      const result = availabilityUtils.getFirstAvailableDate(availability, mockToday);
      expect(result).toBe('2023-10-03');
    });

    it('returns fallback if no future slots match', () => {
      const availability = {
        slotsByDate: {
          '2023-09-30': [{ isAvailable: true }],
        },
      } as any;
      expect(availabilityUtils.getFirstAvailableDate(availability, mockToday)).toBe(mockToday);
    });
  });

  // --- 2. getSlotsForDate ---
  describe('getSlotsForDate', () => {
    it('returns empty array if date is in the past', () => {
      expect(availabilityUtils.getSlotsForDate({}, '2020-01-01', mockToday)).toEqual([]);
    });

    it('returns empty array if availability is missing', () => {
      expect(availabilityUtils.getSlotsForDate(null, '2023-12-01', mockToday)).toEqual([]);
    });

    it('returns empty array if no slots found for date', () => {
      const avail = { slotsByDate: {} } as any;
      expect(availabilityUtils.getSlotsForDate(avail, '2023-12-01', mockToday)).toEqual([]);
    });

    it('filters out unavailable slots', () => {
      const avail = {
        slotsByDate: {
          '2023-12-01': [
            { isAvailable: false, startTime: '09:00' },
            { isAvailable: true, startTime: '10:00 AM' },
          ],
        },
      } as any;

      const result = availabilityUtils.getSlotsForDate(avail, '2023-12-01', mockToday);
      expect(result[0]).toContain('10:00 AM');
      expect(result).toHaveLength(1);
    });

    // -- Detailed Time Normalization Tests --

    it('formats slots using startTimeLocal (Priority 1)', () => {
      const avail = {
        slotsByDate: {
          '2023-12-01': [{ startTimeLocal: '1:00 PM', isAvailable: true }],
        },
      } as any;
      const result = availabilityUtils.getSlotsForDate(avail, '2023-12-01', mockToday);
      // Logic: end falls back to start, formatSlotLabel does `start - end`
      expect(result[0]).toBe('1:00 PM - 1:00 PM');
    });

    it('formats slots using UTC conversion (Priority 2)', () => {
      // 10:00 UTC. With Module loaded in UTC zone, this should remain 10:00 AM.
      const avail = {
        slotsByDate: {
          '2023-12-01': [
            {
              startTimeUtc: '10:00',
              endTimeUtc: '11:00',
              isAvailable: true,
            },
          ],
        },
      } as any;

      const result = availabilityUtils.getSlotsForDate(avail, '2023-12-01', mockToday);
      expect(result[0]).toBe('10:00 AM - 11:00 AM');
    });

    it('handles UTC conversion failure (bad numbers) gracefully by falling back', () => {
      const avail = {
        slotsByDate: {
          '2023-12-01': [
            {
              startTimeUtc: 'bad:time',
              startTime: '09:00 AM', // Fallback
              isAvailable: true,
            },
          ],
        },
      } as any;
      const result = availabilityUtils.getSlotsForDate(avail, '2023-12-01', mockToday);
      expect(result[0]).toContain('9:00 AM');
    });

    it('formats slots using raw string normalization (Priority 3 - ISO Date)', () => {
      // 14:30:00Z in UTC is 2:30 PM.
      const avail = {
        slotsByDate: {
          '2023-12-01': [{ startTime: '2023-12-01T14:30:00Z', isAvailable: true }],
        },
      } as any;
      const result = availabilityUtils.getSlotsForDate(avail, '2023-12-01', mockToday);
      expect(result[0]).toContain('2:30 PM');
    });

    it('formats slots using raw string normalization (Priority 3 - AM/PM)', () => {
      const avail = {
        slotsByDate: {
          '2023-12-01': [{ startTime: '02:30 pm', isAvailable: true }],
        },
      } as any;
      const result = availabilityUtils.getSlotsForDate(avail, '2023-12-01', mockToday);
      expect(result[0]).toBe('2:30 PM - 2:30 PM');
    });

    it('formats slots using raw string normalization (Priority 3 - HH:mm 24h)', () => {
      const avail = {
        slotsByDate: {
          '2023-12-01': [{ startTime: '14:30', isAvailable: true }],
        },
      } as any;
      const result = availabilityUtils.getSlotsForDate(avail, '2023-12-01', mockToday);
      expect(result[0]).toBe('2:30 PM - 2:30 PM');
    });

    it('formats slots using raw string normalization (Priority 3 - HH:mm 12h)', () => {
      const avail = {
        slotsByDate: {
          '2023-12-01': [{ startTime: '09:30', isAvailable: true }],
        },
      } as any;
      const result = availabilityUtils.getSlotsForDate(avail, '2023-12-01', mockToday);
      expect(result[0]).toBe('9:30 AM - 9:30 AM');
    });

    it('returns raw trimmed string if no regex matches', () => {
      const avail = {
        slotsByDate: {
          '2023-12-01': [{ startTime: ' noon ', isAvailable: true }],
        },
      } as any;
      const result = availabilityUtils.getSlotsForDate(avail, '2023-12-01', mockToday);
      expect(result[0]).toBe('noon - noon');
    });

    it('filters out empty/invalid labels', () => {
      const avail = {
        slotsByDate: {
          '2023-12-01': [{ startTime: null, isAvailable: true }],
        },
      } as any;
      const result = availabilityUtils.getSlotsForDate(avail, '2023-12-01', mockToday);
      expect(result).toHaveLength(0);
    });

    it('handles explicit start and end time formatting', () => {
      const avail = {
        slotsByDate: {
          '2023-12-01': [{ startTime: '09:00', endTime: '10:00', isAvailable: true }],
        },
      } as any;
      const result = availabilityUtils.getSlotsForDate(avail, '2023-12-01', mockToday);
      // Normalized: 09:00 -> 9:00 AM
      expect(result[0]).toBe('9:00 AM - 10:00 AM');
    });
  });

  // --- 3. getFutureAvailabilityMarkers ---
  describe('getFutureAvailabilityMarkers', () => {
    it('generates markers for 30 days plus available slots', () => {
      const avail = {
        slotsByDate: {
          '2023-10-02': [{ isAvailable: true }], // In range
          '2023-11-05': [{ isAvailable: true }], // Far future, from avail
          '2023-09-01': [{ isAvailable: true }], // Past, ignored
        },
      } as any;

      const markers = availabilityUtils.getFutureAvailabilityMarkers(avail, mockToday);

      expect(mockParseISODate).toHaveBeenCalledWith(mockToday);
      expect(mockAddDays).toHaveBeenCalled(); // 30 times loop
      expect(markers.has('2023-10-02')).toBe(true);
      expect(markers.has('2023-11-05')).toBe(true);
      expect(markers.has('2023-09-01')).toBe(false);
    });

    it('returns empty if todayISO is invalid', () => {
      mockParseISODate.mockReturnValue(new Date('invalid'));
      const markers = availabilityUtils.getFutureAvailabilityMarkers(null, 'invalid');
      expect(markers.size).toBe(0);
    });

    it('handles null availability', () => {
      const markers = availabilityUtils.getFutureAvailabilityMarkers(null, mockToday);
      expect(mockAddDays).toHaveBeenCalledTimes(30);
      expect(markers.size).toBe(30);
    });
  });

  // --- 4. parseSlotLabel ---
  describe('parseSlotLabel', () => {
    it('returns nulls for missing value', () => {
      expect(availabilityUtils.parseSlotLabel(null)).toEqual({ startTime: null, endTime: null });
      expect(availabilityUtils.parseSlotLabel(undefined)).toEqual({ startTime: null, endTime: null });
    });

    it('parses range label', () => {
      expect(availabilityUtils.parseSlotLabel('09:00 AM - 10:00 AM')).toEqual({
        startTime: '09:00 AM',
        endTime: '10:00 AM',
      });
    });

    it('parses single time label', () => {
      const res = availabilityUtils.parseSlotLabel('09:00 AM');
      expect(res.startTime).toBe('09:00 AM');
      expect(res.endTime).toBeNull();
    });
  });

  // --- 5. findSlotByLabel ---
  describe('findSlotByLabel', () => {
    it('returns null if availability or label is missing', () => {
      expect(availabilityUtils.findSlotByLabel(null, mockToday, 'label')).toBeNull();
      expect(availabilityUtils.findSlotByLabel({} as any, mockToday, null)).toBeNull();
    });

    it('returns null if no slots for date', () => {
      expect(availabilityUtils.findSlotByLabel({ slotsByDate: {} } as any, mockToday, 'label')).toBeNull();
    });

    it('finds slot ignoring case and spaces', () => {
      const slotTarget = { startTime: '09:00', endTime: '10:00' };
      const avail = {
        slotsByDate: {
          [mockToday]: [
            { startTime: '08:00' },
            slotTarget,
          ],
        },
      } as any;

      // Logic produces '9:00 AM - 10:00 AM'. Normalized to '9:00am-10:00am'.
      // Input label ' 9:00 AM - 10:00 AM ' -> normalized '9:00am-10:00am'.
      const found = availabilityUtils.findSlotByLabel(avail, mockToday, ' 9:00 AM - 10:00 AM ');
      expect(found).toBe(slotTarget);
    });

    it('returns null if no match found', () => {
      const avail = {
        slotsByDate: {
          [mockToday]: [{ startTime: '09:00' }],
        },
      } as any;
      expect(availabilityUtils.findSlotByLabel(avail, mockToday, 'Different Time')).toBeNull();
    });
  });
});