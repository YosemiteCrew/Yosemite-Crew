import { calculateCorrectedCalcium } from '@/app/features/calculators/engine/corrected-calcium';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateCorrectedCalcium', () => {
  it('computes the corrected calcium', () => {
    const result = calculateCorrectedCalcium({ totalCalciumMgDl: 9, albuminGdl: 2 });
    expect(result.correctedCalcium).toBe(10.5);
  });

  it('throws for a non-positive total calcium', () => {
    expect(() => calculateCorrectedCalcium({ totalCalciumMgDl: 0, albuminGdl: 2 })).toThrow(
      CalculatorInputError
    );
  });

  it('throws for a non-positive albumin', () => {
    expect(() => calculateCorrectedCalcium({ totalCalciumMgDl: 9, albuminGdl: 0 })).toThrow(
      CalculatorInputError
    );
  });

  it('throws when the corrected value would be negative', () => {
    expect(() => calculateCorrectedCalcium({ totalCalciumMgDl: 1, albuminGdl: 50 })).toThrow(
      'Albumin is too high for the calcium entered; check the values.'
    );
  });
});
