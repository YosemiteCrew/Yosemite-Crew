import {
  formatDate,
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
} from '@/utils/helpers';

describe('helpers', () => {
  describe('formatDate', () => {
    it('should format Date object to readable string', () => {
      const date = new Date('2024-01-15');
      const result = formatDate(date);
      expect(result).toBe('January 15, 2024');
    });

    it('should format date string to readable string', () => {
      const result = formatDate('2024-12-25');
      expect(result).toBe('December 25, 2024');
    });
  });

  describe('formatDateShort', () => {
    it('should format Date object to short string', () => {
      const date = new Date('2024-01-15');
      const result = formatDateShort(date);
      expect(result).toBe('Jan 15, 2024');
    });

    it('should format date string to short string', () => {
      const result = formatDateShort('2024-12-25');
      expect(result).toBe('Dec 25, 2024');
    });
  });

  describe('calculateAge', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-10-10'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should calculate age from Date object', () => {
      const birthDate = new Date('2000-01-01');
      const age = calculateAge(birthDate);
      expect(age).toBe(24);
    });

    it('should calculate age from date string', () => {
      const age = calculateAge('2000-01-01');
      expect(age).toBe(24);
    });

    it('should handle birthday not yet occurred this year', () => {
      const age = calculateAge('2000-12-01');
      expect(age).toBe(23);
    });

    it('should handle same month but day not yet occurred', () => {
      const age = calculateAge('2000-10-15');
      expect(age).toBe(23);
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should lowercase rest of string', () => {
      expect(capitalize('hELLO')).toBe('Hello');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('formatWeight', () => {
    it('should format weight with default kg unit', () => {
      expect(formatWeight(10)).toBe('10 kg');
    });

    it('should format weight with lbs unit', () => {
      expect(formatWeight(20, 'lbs')).toBe('20 lbs');
    });

    it('should handle decimal weights', () => {
      expect(formatWeight(15.5, 'kg')).toBe('15.5 kg');
    });
  });

  describe('generateAvatarUrl', () => {
    it('should generate URL with seed', () => {
      const url = generateAvatarUrl('test-seed');
      expect(url).toBe('https://picsum.photos/200/200?seed=test-seed');
    });

    it('should generate URL with random timestamp when no seed', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1234567890);
      const url = generateAvatarUrl();
      expect(url).toBe('https://picsum.photos/200/200?random=1234567890');
      jest.restoreAllMocks();
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
    });

    it('should validate email with subdomain', () => {
      expect(isValidEmail('user@mail.example.com')).toBe(true);
    });

    it('should reject email without @', () => {
      expect(isValidEmail('testexample.com')).toBe(false);
    });

    it('should reject email without domain', () => {
      expect(isValidEmail('test@')).toBe(false);
    });

    it('should reject email with spaces', () => {
      expect(isValidEmail('test @example.com')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });

    it('should call function after wait time', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 200);

      debouncedFn('test');

      jest.advanceTimersByTime(100);
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledWith('test');
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('arg1');
      throttledFn('arg2');
      throttledFn('arg3');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');
    });

    it('should allow call after limit time', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('first');
      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);

      throttledFn('second');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith('second');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('should generate non-empty strings', () => {
      const id = generateId();
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should resolve after specified time', async () => {
      const promise = sleep(1000);

      jest.advanceTimersByTime(999);
      expect(promise).toBeInstanceOf(Promise);

      jest.advanceTimersByTime(1);
      await promise;
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty string', () => {
      expect(isEmpty('')).toBe(true);
    });

    it('should return true for whitespace only', () => {
      expect(isEmpty('   ')).toBe(true);
      expect(isEmpty('\t\n')).toBe(true);
    });

    it('should return false for non-empty string', () => {
      expect(isEmpty('hello')).toBe(false);
    });

    it('should return false for string with content', () => {
      expect(isEmpty('  hello  ')).toBe(false);
    });
  });

  describe('truncateText', () => {
    it('should not truncate if text is shorter than max length', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('should truncate if text is longer than max length', () => {
      expect(truncateText('Hello World Test', 10)).toBe('Hello Worl...');
    });

    it('should handle exact length', () => {
      expect(truncateText('Hello', 5)).toBe('Hello');
    });

    it('should trim before adding ellipsis', () => {
      expect(truncateText('Hello World', 8)).toBe('Hello Wo...');
    });
  });

  describe('formatNumber', () => {
    it('should format number with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
    });

    it('should format large numbers', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('should handle small numbers without commas', () => {
      expect(formatNumber(100)).toBe('100');
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0');
    });
  });

  describe('getInitials', () => {
    it('should get initials from two-word name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('should get initials from one-word name', () => {
      expect(getInitials('John')).toBe('J');
    });

    it('should get only first two initials from multi-word name', () => {
      expect(getInitials('John Michael Doe')).toBe('JM');
    });

    it('should uppercase initials', () => {
      expect(getInitials('john doe')).toBe('JD');
    });
  });
});
