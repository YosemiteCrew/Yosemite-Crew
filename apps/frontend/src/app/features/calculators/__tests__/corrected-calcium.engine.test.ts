import { calculateCorrectedCalcium } from '@/app/features/calculators/engine/corrected-calcium';

describe('calculateCorrectedCalcium', () => {
  it('computes the albumin-corrected calcium (worked example)', () => {
    const r = calculateCorrectedCalcium({ totalCalciumMgDl: 8, albuminGdl: 2 });
    expect(r.correctedCalcium).toBe(9.5);
  });

  it('rounds the corrected calcium to one decimal place', () => {
    const r = calculateCorrectedCalcium({ totalCalciumMgDl: 9.27, albuminGdl: 3.1 });
    expect(r.correctedCalcium).toBeCloseTo(9.7, 1);
  });

  it('rejects a non-positive total calcium', () => {
    expect(() => calculateCorrectedCalcium({ totalCalciumMgDl: 0, albuminGdl: 2 })).toThrow(
      'Total calcium must be greater than 0.'
    );
  });

  it('rejects a non-positive albumin', () => {
    expect(() => calculateCorrectedCalcium({ totalCalciumMgDl: 8, albuminGdl: 0 })).toThrow(
      'Albumin must be greater than 0.'
    );
  });
});
