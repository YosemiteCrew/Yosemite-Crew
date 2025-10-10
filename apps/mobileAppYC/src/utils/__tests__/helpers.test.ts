import {
  capitalize,
  formatDate,
  formatDateShort,
  calculateAge,
  isValidEmail,
  formatWeight,
  generateAvatarUrl,
  generateId,
  sleep,
  isEmpty,
  truncateText,
  formatNumber,
  getInitials,
  debounce,
  throttle,
} from '@/utils/helpers';

describe('utils/helpers', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-10-10T00:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('formatDate formats long date', () => {
    expect(formatDate('2020-01-15')).toBe('January 15, 2020');
  });

  test('formatDateShort formats short date', () => {
    expect(formatDateShort('2020-01-15')).toBe('Jan 15, 2020');
  });

  test('calculateAge computes correct age considering month/day', () => {
    // With system time set to 2024-10-10
    expect(calculateAge('2000-10-11')).toBe(23);
    expect(calculateAge('2000-10-10')).toBe(24);
    expect(calculateAge('2000-09-09')).toBe(24);
  });

  test('capitalize capitalizes the first letter and lowercases rest', () => {
    expect(capitalize('hELLO')).toBe('Hello');
  });

  test('isValidEmail validates email format', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('invalid@')).toBe(false);
  });

  test('formatWeight appends unit', () => {
    expect(formatWeight(10)).toBe('10 kg');
    expect(formatWeight(22, 'lbs')).toBe('22 lbs');
  });

  test('generateAvatarUrl uses seed when provided', () => {
    expect(generateAvatarUrl('abc')).toContain('https://picsum.photos/200/200?seed=abc');
  });

  test('generateAvatarUrl uses random param when no seed', () => {
    const url = generateAvatarUrl();
    expect(url.startsWith('https://picsum.photos/200/200?random=')).toBe(true);
  });

  test('generateId creates unique-ish ids', () => {
    const a = generateId();
    const b = generateId();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(5);
    expect(a).not.toBe(b);
  });

  test('sleep resolves after given ms', async () => {
    const promise = sleep(500);
    jest.advanceTimersByTime(499);
    let resolved = false;
    promise.then(() => (resolved = true));
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  test('isEmpty checks whitespace and empty strings', () => {
    expect(isEmpty('')).toBe(true);
    expect(isEmpty('   ')).toBe(true);
    expect(isEmpty('x')).toBe(false);
  });

  test('truncateText truncates and appends ellipsis', () => {
    expect(truncateText('short', 10)).toBe('short');
    expect(truncateText('this is long', 4)).toBe('this...');
  });

  test('formatNumber inserts commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  test('getInitials handles one or two words', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('alice')).toBe('A');
  });

  test('debounce calls function once after wait', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 200);
    debounced('a');
    debounced('b');
    debounced('c');
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  test('throttle limits calls within window', () => {
    const fn = jest.fn();
    const throttled = throttle(fn, 100);
    throttled(1);
    throttled(2);
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(100);
    throttled(3);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });
});

