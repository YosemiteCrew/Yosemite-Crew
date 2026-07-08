import { parseOptionalNumber, parseRequiredNumber } from '@/app/features/calculators/utils/form';

describe('parseRequiredNumber', () => {
  it('parses a numeric string', () => {
    expect(parseRequiredNumber('12.5')).toBe(12.5);
  });

  it('returns NaN for a blank string', () => {
    expect(Number.isNaN(parseRequiredNumber(''))).toBe(true);
  });
});

describe('parseOptionalNumber', () => {
  it('returns undefined for a blank or whitespace string', () => {
    expect(parseOptionalNumber('')).toBeUndefined();
    expect(parseOptionalNumber('   ')).toBeUndefined();
  });

  it('parses a numeric string', () => {
    expect(parseOptionalNumber('100')).toBe(100);
  });
});
