import { calculateConcentration } from '@/app/features/calculators/engine/concentration';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateConcentration', () => {
  it('computes the concentration without a dose', () => {
    const result = calculateConcentration({ percentSolution: 5 });
    expect(result.concentrationMgPerMl).toBe(50);
    expect(result.volumeMl).toBeNull();
  });

  it('computes the volume when a dose is provided', () => {
    const result = calculateConcentration({ percentSolution: 5, doseMg: 100 });
    expect(result.concentrationMgPerMl).toBe(50);
    expect(result.volumeMl).toBe(2);
  });

  it('throws for a non-positive percent solution', () => {
    expect(() => calculateConcentration({ percentSolution: 0 })).toThrow(CalculatorInputError);
  });

  it('throws for a non-positive dose', () => {
    expect(() => calculateConcentration({ percentSolution: 5, doseMg: -1 })).toThrow(
      CalculatorInputError
    );
  });
});
