import { calculateAnionGap } from '@/app/features/calculators/engine/anion-gap';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateAnionGap', () => {
  it('computes the anion gap and rounds to one decimal', () => {
    const result = calculateAnionGap({ na: 140, k: 4, cl: 100, hco3: 24 });
    expect(result.anionGap).toBe(20);
  });

  it('rounds a fractional result to one decimal', () => {
    const result = calculateAnionGap({ na: 140.25, k: 4.05, cl: 100, hco3: 24 });
    expect(result.anionGap).toBeCloseTo(20.3, 1);
  });

  it.each([
    ['na', { na: 0, k: 4, cl: 100, hco3: 24 }],
    ['k', { na: 140, k: 0, cl: 100, hco3: 24 }],
    ['cl', { na: 140, k: 4, cl: 0, hco3: 24 }],
    ['hco3', { na: 140, k: 4, cl: 100, hco3: 0 }],
  ])('throws CalculatorInputError when %s is not positive', (field, input) => {
    expect(() => calculateAnionGap(input)).toThrow(CalculatorInputError);
  });
});
