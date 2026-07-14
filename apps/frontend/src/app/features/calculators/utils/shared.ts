// Shared primitives for the veterinary calculation engine. Every calculator
// module reuses these so validation and rounding behave identically.

export type CalculatorSpecies = 'dog' | 'cat';

// Thrown when an input fails validation. `field` lets the UI bind the message
// to the offending input.
export class CalculatorInputError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'CalculatorInputError';
    this.field = field;
  }
}

export const assertFinite = (value: number, field: string, label: string): void => {
  if (!Number.isFinite(value)) {
    throw new CalculatorInputError(field, `${label} is required.`);
  }
};

export const assertPositive = (value: number, field: string, label: string): void => {
  assertFinite(value, field, label);
  if (value <= 0) {
    throw new CalculatorInputError(field, `${label} must be greater than 0.`);
  }
};

export const assertNonNegative = (value: number, field: string, label: string): void => {
  assertFinite(value, field, label);
  if (value < 0) {
    throw new CalculatorInputError(field, `${label} cannot be negative.`);
  }
};

export const assertInRange = (
  value: number,
  field: string,
  label: string,
  min: number,
  max: number
): void => {
  assertFinite(value, field, label);
  if (value < min || value > max) {
    throw new CalculatorInputError(field, `${label} must be between ${min} and ${max}.`);
  }
};

export const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
