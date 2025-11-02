import { formatTimeForDisplay } from '@/shared/utils/timeHelpers';

describe('formatTimeForDisplay', () => {
  // We will use jest.spyOn to mock the Date.prototype.toLocaleTimeString
  let toLocaleTimeStringSpy: jest.SpyInstance;

  beforeAll(() => {
    // Set up the spy *before* all tests run
    toLocaleTimeStringSpy = jest
      .spyOn(Date.prototype, 'toLocaleTimeString')
      .mockImplementation(function (
        this: Date, // 'this' will be the Date object
        locales,
        options,
      ) {
        // Check if it's the specific call we expect
        if (
          locales === 'en-US' &&
          options?.hour === 'numeric' &&
          options.minute === '2-digit' &&
          options.hour12 === true
        ) {
          // Create a predictable, formatted string
          const hour = this.getHours();
          const minute = this.getMinutes();
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
          const formattedMinute = String(minute).padStart(2, '0');
          return `${formattedHour}:${formattedMinute} ${ampm}`;
        }

        // Fallback for any other calls (just in case)
        return 'Invalid Mock Call';
      });
  });

  afterAll(() => {
    // Restore the original function after all tests are done
    toLocaleTimeStringSpy.mockRestore();
  });

  it('should return an empty string for null input', () => {
    expect(formatTimeForDisplay(null)).toBe('');
  });

  it('should return an empty string for undefined input', () => {
    // Cast to 'any' to test the !time guard for undefined
    expect(formatTimeForDisplay(undefined as any)).toBe('');
  });

  it('should format a PM time correctly', () => {
    // 5:30 PM
    const pmDate = new Date();
    pmDate.setHours(17, 30);
    expect(formatTimeForDisplay(pmDate)).toBe('5:30 PM');
  });

  it('should format an AM time correctly', () => {
    // 9:05 AM
    const amDate = new Date();
    amDate.setHours(9, 5);
    expect(formatTimeForDisplay(amDate)).toBe('9:05 AM');
  });

  it('should format noon correctly', () => {
    // 12:00 PM
    const noonDate = new Date();
    noonDate.setHours(12, 0);
    expect(formatTimeForDisplay(noonDate)).toBe('12:00 PM');
  });

  it('should format midnight correctly', () => {
    // 12:00 AM
    const midnightDate = new Date();
    midnightDate.setHours(0, 0);
    expect(formatTimeForDisplay(midnightDate)).toBe('12:00 AM');
  });
});