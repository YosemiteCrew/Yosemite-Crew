import {
  screenWidth,
  screenHeight,
  // isIOS and isAndroid are imported inside tests
  formatDate,
  calculateAgeFromDateOfBirth,
  formatDateShort,
  calculateAge,
  capitalize,
  formatWeight,
  generateAvatarUrl,
  isValidEmail,
  debounce,
  throttle,
  generateId,
  sleep,
  isEmpty,
  truncateText,
  formatNumber,
  getInitials,
  formatLabel,
} from '@/shared/utils/helpers';
// Platform import is no longer needed here

// --- Mocks ---
// Set the DEFAULT mock for react-native
jest.mock('react-native', () => ({
  Dimensions: {
    get: jest.fn(() => ({ width: 400, height: 800 })),
  },
  Platform: {
    OS: 'ios',
  },
  NativeModules: {
    RNGetRandomValues: {
      getRandomBase64: jest.fn(),
    },
  },
}));

// Set a fixed "today" for all date-related tests
// Today: Oct 31, 2025 (a Friday)
const MOCK_TODAY = new Date('2025-10-31T12:00:00Z');

describe('helpers', () => {
  // --- Timer & Date Mock Setup ---
  let toLocaleDateStringSpy: jest.SpyInstance;

  beforeAll(() => {
    // Use fake timers to control setTimeout and new Date()
    jest.useFakeTimers();
    jest.setSystemTime(MOCK_TODAY);

    // Mock toLocaleDateString to return predictable, non-locale-specific values
    toLocaleDateStringSpy = jest
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockImplementation(function (this: Date, locales, options) {
        if (locales !== 'en-US') return 'Invalid Locale';

        if (options?.year === 'numeric' && options.month === 'long') {
          return 'October 31, 2025';
        }
        if (options?.year === 'numeric' && options.month === 'short') {
          return 'Oct 31, 2025';
        }
        return 'Mocked Date';
      });
  });

  afterAll(() => {
    // Restore all mocks
    toLocaleDateStringSpy.mockRestore();
    jest.useRealTimers();
  });

  // --- THIS BLOCK IS NOW CORRECTED ---
  describe('Device Dimensions & Platform', () => {
    afterEach(() => {
      jest.resetModules(); // This is key. It clears the module cache.
    });

    it('should get correct screen dimensions', () => {
      // This test uses the default mock (ios)
      expect(screenWidth).toBe(400);
      expect(screenHeight).toBe(800);
    });

    it('should correctly identify iOS', () => {
      // Set up the mock for 'ios'
      jest.mock('react-native', () => ({
        Dimensions: { get: jest.fn(() => ({ width: 400, height: 800 })) },
        Platform: { OS: 'ios' },
        NativeModules: { RNGetRandomValues: { getRandomBase64: jest.fn() } },
      }));

      // Use require() to get the re-evaluated module
      const { isIOS, isAndroid } = require('@/shared/utils/helpers');
      expect(isIOS).toBe(true);
      expect(isAndroid).toBe(false);
    });

    it('should correctly identify Android', () => {
      // Set up the mock for 'android'
      jest.mock('react-native', () => ({
        Dimensions: { get: jest.fn(() => ({ width: 400, height: 800 })) },
        Platform: { OS: 'android' },
        NativeModules: { RNGetRandomValues: { getRandomBase64: jest.fn() } },
      }));

      // Use require() to get the re-evaluated module
      const { isIOS, isAndroid } = require('@/shared/utils/helpers');

      expect(isIOS).toBe(false);
      expect(isAndroid).toBe(true);
    });
  });
  // --- END OF CORRECTED BLOCK ---

  describe('Date/Time Formatting', () => {
    const testDate = new Date('2025-10-31T00:00:00Z');
    const testDateStr = '2025-10-31T00:00:00Z';

    it('formatDate: should format from a Date object', () => {
      expect(formatDate(testDate)).toBe('October 31, 2025');
    });

    it('formatDate: should format from a string', () => {
      expect(formatDate(testDateStr)).toBe('October 31, 2025');
    });

    it('formatDateShort: should format from a Date object', () => {
      expect(formatDateShort(testDate)).toBe('Oct 31, 2025');
    });

    it('formatDateShort: should format from a string', () => {
      expect(formatDateShort(testDateStr)).toBe('Oct 31, 2025');
    });
  });

  describe('calculateAge', () => {
    // MOCK_TODAY is Oct 31, 2025
    it('should calculate age when birthday has passed', () => {
      expect(calculateAge('2000-01-15')).toBe(25);
    });

    it('should calculate age when birthday is today', () => {
      expect(calculateAge('2000-10-31')).toBe(25);
    });

    it('should calculate age when birthday has not passed', () => {
      expect(calculateAge('2000-11-15')).toBe(24);
    });

    it('should calculate age from a Date object', () => {
      const dob = new Date('2005-05-05');
      expect(calculateAge(dob)).toBe(20);
    });
  });

  describe('calculateAgeFromDateOfBirth', () => {
    // MOCK_TODAY is Oct 31, 2025
    it('should calculate age when birthday has passed', () => {
      expect(calculateAgeFromDateOfBirth('2000-01-15')).toBe(25);
    });

    it('should calculate age when birthday is today', () => {
      expect(calculateAgeFromDateOfBirth('2000-10-31')).toBe(25);
    });

    it('should calculate age when birthday has not passed (month diff < 0)', () => {
      // This covers the `monthDifference < 0` branch
      expect(calculateAgeFromDateOfBirth('2000-11-15')).toBe(24);
    });

    it('should calculate age when birthday has not passed (same month, day <)', () => {
      // This covers the `monthDifference === 0` branch
      const dob = new Date('2025-10-30'); // Yesterday
      expect(calculateAgeFromDateOfBirth(dob)).toBe(0);
    });

    it('should return 0 for a future date', () => {
      // This covers the Math.max(0, age) branch
      expect(calculateAgeFromDateOfBirth('2030-01-01')).toBe(0);
    });
  });

  describe('String Formatting', () => {
    it('capitalize: should capitalize the first letter and lowercase the rest', () => {
      expect(capitalize('hElLo')).toBe('Hello');
    });

    it('formatWeight: should use default unit (kg)', () => {
      expect(formatWeight(80)).toBe('80 kg');
    });

    it('formatWeight: should use specified unit (lbs)', () => {
      expect(formatWeight(150, 'lbs')).toBe('150 lbs');
    });

    it('isEmpty: should return true for null/undefined/empty/whitespace', () => {
      expect(isEmpty(null as any)).toBe(true);
      expect(isEmpty(undefined as any)).toBe(true);
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('   ')).toBe(true);
    });

    it('isEmpty: should return false for non-empty strings', () => {
      expect(isEmpty('a')).toBe(false);
      expect(isEmpty(' a ')).toBe(false);
    });

    it('truncateText: should not truncate if text is short', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('truncateText: should truncate and add ellipsis', () => {
      expect(truncateText('Hello world, this is long', 10)).toBe('Hello worl...');
    });

    it('truncateText: should trim trailing whitespace before ellipsis', () => {
      expect(truncateText('Hello     ', 5)).toBe('Hello...');
    });

    it('formatNumber: should format integers', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('formatNumber: should format negative integers', () => {
      expect(formatNumber(-5000)).toBe('-5,000');
    });

    it('formatNumber: should format decimals', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56');
    });

    it('formatNumber: should format negative decimals', () => {
      expect(formatNumber(-1234.56)).toBe('-1,234.56');
    });

    it('getInitials: should get initials from two words', () => {
      expect(getInitials('Test User')).toBe('TU');
    });

    it('getInitials: should get initials from lowercase', () => {
      expect(getInitials('test user')).toBe('TU');
    });

    it('getInitials: should take only the first two initials', () => {
      expect(getInitials('Test User Name')).toBe('TU');
    });

    it('getInitials: should handle one word', () => {
      expect(getInitials('Test')).toBe('T');
    });

    it('formatLabel: should capitalize and replace hyphens', () => {
      expect(formatLabel('test-user-name')).toBe('Test user name');
    });

    it('formatLabel: should return fallback for null', () => {
      expect(formatLabel(null, 'Default')).toBe('Default');
    });

    it('formatLabel: should return empty string for null and no fallback', () => {
      expect(formatLabel(null)).toBe('');
    });
  });

  describe('generateAvatarUrl', () => {
    it('should generate URL with a seed', () => {
      expect(generateAvatarUrl('my-seed')).toBe(
        'https://picsum.photos/200/200?seed=my-seed',
      );
    });

    it('should generate URL with random date param if no seed', () => {
      // MOCK_TODAY's timestamp is 1761912000000
      expect(generateAvatarUrl()).toBe(
        'https://picsum.photos/200/200?random=1761912000000',
      );
    });
  });

  describe('isValidEmail', () => {
    it.each([
      ['test@example.com'],
      ['test.user@example.co.uk'],
      ['123@abc.dev'],
    ])('should return true for valid email: %s', email => {
      expect(isValidEmail(email)).toBe(true);
    });

    it.each([
      ['plainaddress'], // Missing @
      ['@example.com'], // Missing local part
      ['test@'], // Missing domain
      ['test@example.com.'], // Domain ends with dot
      ['test@.example.com'], // Domain starts with dot
      ['test@example com'], // Contains whitespace
      ['test@example@test.com'], // Contains multiple @
      ['test@examplecom'], // Missing dot in domain
      ['a'.repeat(321) + '@example.com'], // Too long
    ])('should return false for invalid email: %s', email => {
      expect(isValidEmail(email)).toBe(false);
    });

    it('should return false for null or empty string', () => {
      expect(isValidEmail(null as any)).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('debounce', () => {
    it('should only call the function once after the wait time', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);

      debouncedFn();
      debouncedFn();
      debouncedFn(); // Called 3 times in a row

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500); // Advance timer

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    it('should only call the function once within the limit', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 500);

      throttledFn();
      throttledFn();
      throttledFn(); // Called 3 times

      expect(mockFn).toHaveBeenCalledTimes(1); // But only runs once

      jest.advanceTimersByTime(500); // Advance past limit
      throttledFn(); // Call again

      expect(mockFn).toHaveBeenCalledTimes(2); // Now it runs again
    });
  });

  // --- THIS BLOCK IS NOW CORRECTED ---
  describe('generateId', () => {
    const originalCrypto = globalThis.crypto;

    afterEach(() => {
      globalThis.crypto = originalCrypto; // Restore original crypto
    });

    it('should use crypto.randomUUID if available', () => {
      const mockUUID = 'mock-uuid-123';

      // FIX 1: Cast mock to 'as any' and mock randomUUID as a function
      globalThis.crypto = {
        ...originalCrypto,
        randomUUID: jest.fn(() => mockUUID),
      } as any;

      expect(generateId()).toBe(mockUUID);
    });

    it('should use crypto.getRandomValues if randomUUID is not available', () => {
      // FIX 2: Cast mock to 'as any' to allow setting randomUUID to undefined
      globalThis.crypto = {
        ...originalCrypto,
        randomUUID: undefined,
        getRandomValues: jest.fn(buffer => {
          // Fill buffer with mock data
          for (let i = 0; i < 16; i++) {
            buffer[i] = i;
          }
          return buffer;
        }) as any,
      } as any;

      const expectedHex = '00010203-0405-0607-0809-0a0b0c0d0e0f';
      expect(generateId()).toBe(expectedHex);
    });

    it('should throw an error if no crypto method is available', () => {
      // FIX 3: Cast mock to 'as any' to allow setting properties to undefined
      globalThis.crypto = {
        ...originalCrypto,
        randomUUID: undefined,
        getRandomValues: undefined,
      } as any;

      expect(() => generateId()).toThrow(
        'Secure random number generator is unavailable',
      );
    });
  });
  // --- END OF CORRECTED BLOCK ---

  describe('sleep', () => {
    it('should resolve after the specified ms', async () => {
      const sleepPromise = sleep(1000);
      let resolved = false;
      sleepPromise.then(() => (resolved = true));

      expect(resolved).toBe(false);
      jest.advanceTimersByTime(1000);
      await Promise.resolve(); // Allow promise microtask to resolve
      expect(resolved).toBe(true);
    });
  });
});