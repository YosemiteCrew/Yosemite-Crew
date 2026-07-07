import {
  CalculatorInputError,
  assertFinite,
  assertPositive,
  assertNonNegative,
  assertInRange,
  roundTo,
} from '@/app/features/calculators/utils/shared';

describe('CalculatorInputError', () => {
  it('carries the field and message', () => {
    const err = new CalculatorInputError('weight', 'Weight is required.');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('CalculatorInputError');
    expect(err.field).toBe('weight');
    expect(err.message).toBe('Weight is required.');
  });
});

describe('assertFinite', () => {
  it('does not throw for a finite number', () => {
    expect(() => assertFinite(5, 'weight', 'Weight')).not.toThrow();
  });

  it('throws CalculatorInputError for NaN', () => {
    expect(() => assertFinite(NaN, 'weight', 'Weight')).toThrow(CalculatorInputError);
  });

  it('throws CalculatorInputError for Infinity', () => {
    try {
      assertFinite(Infinity, 'weight', 'Weight');
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(CalculatorInputError);
      expect((err as CalculatorInputError).field).toBe('weight');
      expect((err as CalculatorInputError).message).toBe('Weight is required.');
    }
  });
});

describe('assertPositive', () => {
  it('does not throw for a positive number', () => {
    expect(() => assertPositive(1, 'dose', 'Dose')).not.toThrow();
  });

  it('throws for zero', () => {
    expect(() => assertPositive(0, 'dose', 'Dose')).toThrow('Dose must be greater than 0.');
  });

  it('throws for a negative number', () => {
    expect(() => assertPositive(-1, 'dose', 'Dose')).toThrow(CalculatorInputError);
  });

  it('throws for a non-finite number before the positivity check', () => {
    expect(() => assertPositive(NaN, 'dose', 'Dose')).toThrow('Dose is required.');
  });
});

describe('assertNonNegative', () => {
  it('does not throw for zero', () => {
    expect(() => assertNonNegative(0, 'losses', 'Losses')).not.toThrow();
  });

  it('does not throw for a positive number', () => {
    expect(() => assertNonNegative(5, 'losses', 'Losses')).not.toThrow();
  });

  it('throws for a negative number', () => {
    expect(() => assertNonNegative(-1, 'losses', 'Losses')).toThrow('Losses cannot be negative.');
  });

  it('throws for a non-finite number before the negativity check', () => {
    expect(() => assertNonNegative(NaN, 'losses', 'Losses')).toThrow('Losses is required.');
  });
});

describe('assertInRange', () => {
  it('does not throw for a value within range', () => {
    expect(() => assertInRange(5, 'pct', 'Percent', 0, 10)).not.toThrow();
  });

  it('does not throw for boundary values', () => {
    expect(() => assertInRange(0, 'pct', 'Percent', 0, 10)).not.toThrow();
    expect(() => assertInRange(10, 'pct', 'Percent', 0, 10)).not.toThrow();
  });

  it('throws when below the minimum', () => {
    expect(() => assertInRange(-1, 'pct', 'Percent', 0, 10)).toThrow(
      'Percent must be between 0 and 10.'
    );
  });

  it('throws when above the maximum', () => {
    expect(() => assertInRange(11, 'pct', 'Percent', 0, 10)).toThrow(CalculatorInputError);
  });

  it('throws for a non-finite number before the range check', () => {
    expect(() => assertInRange(NaN, 'pct', 'Percent', 0, 10)).toThrow('Percent is required.');
  });
});

describe('roundTo', () => {
  it('rounds to the given number of decimal places', () => {
    expect(roundTo(1.2345, 2)).toBe(1.23);
    expect(roundTo(1.2355, 2)).toBe(1.24);
  });

  it('rounds to zero decimal places', () => {
    expect(roundTo(4.6, 0)).toBe(5);
  });

  it('handles negative numbers', () => {
    expect(roundTo(-1.2345, 2)).toBe(-1.23);
  });
});
