import { calculateShockBolus } from '@/app/features/calculators/engine/shock-bolus';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateShockBolus', () => {
  it('uses the default duration of 15 minutes when none is provided', () => {
    const result = calculateShockBolus({ weightKg: 10, doseMlPerKg: 20 });
    expect(result.bolusMl).toBe(200);
    expect(result.rateMlPerHr).toBe(800);
  });

  it('uses a custom duration when provided', () => {
    const result = calculateShockBolus({ weightKg: 10, doseMlPerKg: 20, minutes: 30 });
    expect(result.rateMlPerHr).toBe(400);
  });

  it('throws for a non-positive weight', () => {
    expect(() => calculateShockBolus({ weightKg: 0, doseMlPerKg: 20 })).toThrow(
      CalculatorInputError
    );
  });

  it('throws for a non-positive dose', () => {
    expect(() => calculateShockBolus({ weightKg: 10, doseMlPerKg: 0 })).toThrow(
      CalculatorInputError
    );
  });

  it('throws for a non-positive duration', () => {
    expect(() => calculateShockBolus({ weightKg: 10, doseMlPerKg: 20, minutes: 0 })).toThrow(
      CalculatorInputError
    );
  });
});
