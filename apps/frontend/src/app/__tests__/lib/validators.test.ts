import {
  toDisplayNumber,
  toPayloadNumber,
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

describe('toDisplayNumber and toPayloadNumber', () => {
  /* The two disagree on exactly one input - a blank - and that disagreement is
     the whole point. `Number('')`, `Number('   ')` and `Number(null)` are all 0,
     so toNumberSafe cannot tell "nobody filled this in" from "somebody typed 0".
     That conflation printed "$0" for an unpriced item and, worse, SAVED a blank
     price as a real zero. */
  const blanks = ['', '   ', null, undefined];

  it.each(blanks)('reads a blank (%p) as unknown, not zero', (value) => {
    expect(toDisplayNumber(value)).toBeUndefined();
  });

  it.each(blanks)('sends a blank (%p) as null, so the field is cleared', (value) => {
    // null, not undefined: the API's update path skips undefined and leaves the
    // stored value alone, and writes `value ?? null` for anything else. A user
    // who clears a price means clear it.
    expect(toPayloadNumber(value)).toBeNull();
  });

  it('keeps a real zero in both', () => {
    for (const zero of [0, '0', '0.00']) {
      expect(toDisplayNumber(zero)).toBe(0);
      expect(toPayloadNumber(zero)).toBe(0);
    }
  });

  it('passes ordinary numbers through unchanged', () => {
    expect(toDisplayNumber('12.5')).toBe(12.5);
    expect(toPayloadNumber('12.5')).toBe(12.5);
    expect(toDisplayNumber(-3)).toBe(-3);
    expect(toPayloadNumber(-3)).toBe(-3);
  });

  it('omits a malformed value rather than clearing the stored one', () => {
    // undefined from the payload helper, so a typo leaves the saved figure
    // alone instead of wiping it; undefined from the display helper so the
    // surface shows an em dash.
    expect(toPayloadNumber('abc')).toBeUndefined();
    expect(toDisplayNumber('abc')).toBeUndefined();
  });

  it('differs from toNumberSafe only on the blank', () => {
    expect(toNumberSafe('')).toBe(0);
    expect(toDisplayNumber('')).toBeUndefined();
    expect(toPayloadNumber('')).toBeNull();
  });
});
