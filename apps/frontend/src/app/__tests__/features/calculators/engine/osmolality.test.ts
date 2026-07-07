import { calculateOsmolality } from '@/app/features/calculators/engine/osmolality';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateOsmolality', () => {
  it('computes the calculated osmolality without a measured value', () => {
    const result = calculateOsmolality({ na: 140, k: 4, glucoseMgDl: 90, bunMgDl: 14 });
    expect(result.calculatedOsm).toBeCloseTo(298, 1);
    expect(result.osmolalGap).toBeNull();
  });

  it('computes the osmolal gap when a measured value is provided', () => {
    const result = calculateOsmolality({
      na: 140,
      k: 4,
      glucoseMgDl: 90,
      bunMgDl: 14,
      measuredOsm: 310,
    });
    expect(result.osmolalGap).toBeCloseTo(12, 0);
  });

  it.each([
    ['na', { na: 0, k: 4, glucoseMgDl: 90, bunMgDl: 14 }],
    ['k', { na: 140, k: 0, glucoseMgDl: 90, bunMgDl: 14 }],
    ['glucoseMgDl', { na: 140, k: 4, glucoseMgDl: 0, bunMgDl: 14 }],
    ['bunMgDl', { na: 140, k: 4, glucoseMgDl: 90, bunMgDl: 0 }],
  ])('throws when %s is not positive', (_field, input) => {
    expect(() => calculateOsmolality(input)).toThrow(CalculatorInputError);
  });

  it('throws for a non-positive measured osmolality', () => {
    expect(() =>
      calculateOsmolality({ na: 140, k: 4, glucoseMgDl: 90, bunMgDl: 14, measuredOsm: 0 })
    ).toThrow(CalculatorInputError);
  });
});
