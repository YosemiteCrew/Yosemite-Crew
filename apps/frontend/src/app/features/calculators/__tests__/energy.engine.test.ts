import { calculateEnergyRequirement } from '@/app/features/calculators/engine/energy';

describe('calculateEnergyRequirement', () => {
  it('computes RER, MER and feeding amount with all inputs provided', () => {
    const r = calculateEnergyRequirement({
      weightKg: 10,
      merFactor: 1.6,
      dietKcalPer100g: 350,
    });
    expect(r.rerKcalPerDay).toBe(394);
    expect(r.merKcalPerDay).toBe(630);
    expect(r.gramsPerDay).toBe(180);
  });

  it('defaults the MER factor to 1.6 and returns null grams without diet energy', () => {
    const r = calculateEnergyRequirement({ weightKg: 5 });
    // rer = 70 * 5^0.75 = 234.059..., mer = rer * 1.6 = 374.494... (formula is authoritative)
    expect(r.rerKcalPerDay).toBe(234);
    expect(r.merKcalPerDay).toBe(374);
    expect(r.gramsPerDay).toBeNull();
  });

  it('uses a provided MER factor', () => {
    const r = calculateEnergyRequirement({ weightKg: 5, merFactor: 2 });
    // rer = 70 * 5^0.75 = 234.06..., mer = rer * 2 = 468.13...
    expect(r.rerKcalPerDay).toBe(234);
    expect(r.merKcalPerDay).toBe(468);
    expect(r.gramsPerDay).toBeNull();
  });

  it('computes grams per day from diet energy while defaulting the factor', () => {
    const r = calculateEnergyRequirement({ weightKg: 10, dietKcalPer100g: 350 });
    expect(r.rerKcalPerDay).toBe(394);
    expect(r.merKcalPerDay).toBe(630);
    expect(r.gramsPerDay).toBe(180);
  });

  it('rejects a non-positive weight', () => {
    expect(() => calculateEnergyRequirement({ weightKg: 0 })).toThrow(
      'Weight must be greater than 0.'
    );
  });

  it('rejects a non-positive MER factor when provided', () => {
    expect(() => calculateEnergyRequirement({ weightKg: 10, merFactor: 0 })).toThrow(
      'MER factor must be greater than 0.'
    );
  });

  it('rejects a non-positive diet energy when provided', () => {
    expect(() => calculateEnergyRequirement({ weightKg: 10, dietKcalPer100g: 0 })).toThrow(
      'Diet energy must be greater than 0.'
    );
  });
});
