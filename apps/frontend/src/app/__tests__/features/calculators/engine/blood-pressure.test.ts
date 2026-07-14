import { classifyBloodPressure } from '@/app/features/calculators/engine/blood-pressure';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('classifyBloodPressure', () => {
  it('classifies below 140 as normotensive with minimal risk', () => {
    expect(classifyBloodPressure({ sbpMmHg: 130 })).toEqual({
      category: 'Normotensive',
      risk: 'Minimal',
    });
  });

  it('classifies 140-159 as prehypertensive with low risk', () => {
    expect(classifyBloodPressure({ sbpMmHg: 150 })).toEqual({
      category: 'Prehypertensive',
      risk: 'Low',
    });
  });

  it('classifies 160-179 as hypertensive with moderate risk', () => {
    expect(classifyBloodPressure({ sbpMmHg: 170 })).toEqual({
      category: 'Hypertensive',
      risk: 'Moderate',
    });
  });

  it('classifies 180 and above as severely hypertensive with high risk', () => {
    expect(classifyBloodPressure({ sbpMmHg: 180 })).toEqual({
      category: 'Severely hypertensive',
      risk: 'High',
    });
  });

  it('throws for a non-positive value', () => {
    expect(() => classifyBloodPressure({ sbpMmHg: 0 })).toThrow(CalculatorInputError);
  });
});
