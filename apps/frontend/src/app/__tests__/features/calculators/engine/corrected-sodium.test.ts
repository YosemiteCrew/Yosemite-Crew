import { calculateCorrectedSodium } from '@/app/features/calculators/engine/corrected-sodium';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateCorrectedSodium', () => {
  it('computes the corrected sodium', () => {
    const result = calculateCorrectedSodium({ measuredNa: 140, glucoseMgDl: 300 });
    expect(result.correctedNa).toBe(143.2);
  });

  it('returns the measured sodium unchanged when glucose is at baseline', () => {
    const result = calculateCorrectedSodium({ measuredNa: 140, glucoseMgDl: 100 });
    expect(result.correctedNa).toBe(140);
  });

  it('throws when measured sodium is out of range', () => {
    expect(() => calculateCorrectedSodium({ measuredNa: 99, glucoseMgDl: 100 })).toThrow(
      CalculatorInputError
    );
    expect(() => calculateCorrectedSodium({ measuredNa: 201, glucoseMgDl: 100 })).toThrow(
      CalculatorInputError
    );
  });

  it('throws for a non-positive glucose value', () => {
    expect(() => calculateCorrectedSodium({ measuredNa: 140, glucoseMgDl: 0 })).toThrow(
      CalculatorInputError
    );
  });
});
