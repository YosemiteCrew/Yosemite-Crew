import { calculateEnergyRequirement } from '@/app/features/calculators/engine/energy';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateEnergyRequirement', () => {
  it('uses the default MER factor and omits grams per day without diet energy', () => {
    const result = calculateEnergyRequirement({ weightKg: 10 });
    expect(result.rerKcalPerDay).toBe(394);
    expect(result.merKcalPerDay).toBe(630);
    expect(result.gramsPerDay).toBeNull();
  });

  it('uses a custom MER factor', () => {
    const result = calculateEnergyRequirement({ weightKg: 10, merFactor: 2 });
    expect(result.merKcalPerDay).toBe(787);
  });

  it('computes grams per day when diet energy is provided', () => {
    const result = calculateEnergyRequirement({ weightKg: 10, dietKcalPer100g: 350 });
    expect(result.gramsPerDay).toBe(180);
  });

  it('throws for a non-positive weight', () => {
    expect(() => calculateEnergyRequirement({ weightKg: 0 })).toThrow(CalculatorInputError);
  });

  it('throws for a non-positive MER factor', () => {
    expect(() => calculateEnergyRequirement({ weightKg: 10, merFactor: 0 })).toThrow(
      CalculatorInputError
    );
  });

  it('throws for a non-positive diet energy', () => {
    expect(() => calculateEnergyRequirement({ weightKg: 10, dietKcalPer100g: 0 })).toThrow(
      CalculatorInputError
    );
  });
});
