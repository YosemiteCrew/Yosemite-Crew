import { calculateIrisStage } from '@/app/features/calculators/engine/iris-stage';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateIrisStage', () => {
  it('classifies a dog below 1.4 as stage 1 nonazotemic', () => {
    const result = calculateIrisStage({ species: 'dog', creatinineMgDl: 1.0 });
    expect(result).toEqual({ stage: 1, interpretation: 'Nonazotemic' });
  });

  it('classifies a cat below 1.6 as stage 1 nonazotemic', () => {
    const result = calculateIrisStage({ species: 'cat', creatinineMgDl: 1.5 });
    expect(result).toEqual({ stage: 1, interpretation: 'Nonazotemic' });
  });

  it('classifies stage 2 mild renal azotemia at the dog threshold', () => {
    const result = calculateIrisStage({ species: 'dog', creatinineMgDl: 1.4 });
    expect(result).toEqual({ stage: 2, interpretation: 'Mild renal azotemia' });
  });

  it('classifies stage 3 moderate renal azotemia', () => {
    const result = calculateIrisStage({ species: 'dog', creatinineMgDl: 4 });
    expect(result).toEqual({ stage: 3, interpretation: 'Moderate renal azotemia' });
  });

  it('classifies stage 4 severe renal azotemia above 5', () => {
    const result = calculateIrisStage({ species: 'dog', creatinineMgDl: 5.1 });
    expect(result).toEqual({ stage: 4, interpretation: 'Severe renal azotemia' });
  });

  it('throws for a non-positive creatinine value', () => {
    expect(() => calculateIrisStage({ species: 'dog', creatinineMgDl: 0 })).toThrow(
      CalculatorInputError
    );
  });
});
