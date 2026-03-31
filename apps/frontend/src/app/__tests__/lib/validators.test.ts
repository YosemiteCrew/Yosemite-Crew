import {
  validatePhone,
  getCountryCode,
  isValidEmail,
  toTitleCase,
  toTitle,
  toNumberSafe,
} from '@/app/lib/validators';

describe('validatePhone', () => {
  it('returns true for a valid international phone number', () => {
    expect(validatePhone('+14155552671')).toBe(true);
  });

  it('returns false for an invalid phone number', () => {
    expect(validatePhone('not-a-phone')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validatePhone('')).toBe(false);
  });
});

describe('getCountryCode', () => {
  it('returns a country object for a known country name', () => {
    const result = getCountryCode('India');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('India');
  });

  it('returns null for an unknown country', () => {
    expect(getCountryCode('Wakanda')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getCountryCode(undefined)).toBeNull();
  });
});

describe('isValidEmail', () => {
  it('returns true for a valid email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('returns true for email with leading/trailing spaces', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true);
  });

  it('returns false for invalid email', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

describe('toTitleCase', () => {
  it('capitalizes first letter and lowercases rest', () => {
    expect(toTitleCase('hello')).toBe('Hello');
  });

  it('handles all-caps input', () => {
    expect(toTitleCase('WORLD')).toBe('World');
  });

  it('returns empty string for empty input', () => {
    expect(toTitleCase('')).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(toTitleCase(undefined)).toBe('');
  });

  it('handles non-string gracefully', () => {
    expect(toTitleCase(undefined)).toBe('');
  });
});

describe('toTitle', () => {
  it('converts underscore-separated string to title case', () => {
    expect(toTitle('hello_world')).toBe('Hello world');
  });

  it('converts dash-separated string', () => {
    expect(toTitle('foo-bar')).toBe('Foo bar');
  });

  it('trims whitespace', () => {
    expect(toTitle('  hello  ')).toBe('Hello');
  });

  it('returns empty string for undefined', () => {
    expect(toTitle(undefined)).toBe('');
  });

  it('handles multiple separators', () => {
    expect(toTitle('IN_PROGRESS')).toBe('In progress');
  });
});

describe('toNumberSafe', () => {
  it('converts a numeric string', () => {
    expect(toNumberSafe('42')).toBe(42);
  });

  it('converts a number', () => {
    expect(toNumberSafe(3.14)).toBe(3.14);
  });

  it('returns fallback for NaN string', () => {
    expect(toNumberSafe('abc')).toBe(0);
  });

  it('returns fallback for null', () => {
    expect(toNumberSafe(null)).toBe(0);
  });

  it('returns fallback for undefined', () => {
    expect(toNumberSafe(undefined)).toBe(0);
  });

  it('uses a custom fallback', () => {
    expect(toNumberSafe('x', -1)).toBe(-1);
  });

  it('returns 0 for empty string', () => {
    // Number('') === 0, which is finite
    expect(toNumberSafe('')).toBe(0);
  });
});
