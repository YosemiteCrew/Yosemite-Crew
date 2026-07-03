import { calculateShockBolus } from '@/app/features/calculators/engine/shock-bolus';

describe('calculateShockBolus', () => {
  it('computes bolus and rate with explicit minutes', () => {
    const r = calculateShockBolus({ weightKg: 20, doseMlPerKg: 20, minutes: 15 });
    expect(r.bolusMl).toBe(400);
    expect(r.rateMlPerHr).toBe(1600);
  });

  it('defaults to 15 minutes when minutes is absent', () => {
    const r = calculateShockBolus({ weightKg: 5, doseMlPerKg: 10 });
    expect(r.bolusMl).toBe(50);
    expect(r.rateMlPerHr).toBe(200);
  });

  it('uses provided minutes for the rate', () => {
    const r = calculateShockBolus({ weightKg: 10, doseMlPerKg: 30, minutes: 30 });
    expect(r.bolusMl).toBe(300);
    expect(r.rateMlPerHr).toBeCloseTo(600, 0);
  });

  it('rejects a non-positive weight', () => {
    expect(() => calculateShockBolus({ weightKg: 0, doseMlPerKg: 20 })).toThrow(
      'Weight must be greater than 0.'
    );
  });

  it('rejects a non-positive bolus dose', () => {
    expect(() => calculateShockBolus({ weightKg: 20, doseMlPerKg: 0 })).toThrow(
      'Bolus dose must be greater than 0.'
    );
  });

  it('rejects non-positive minutes when provided', () => {
    expect(() => calculateShockBolus({ weightKg: 20, doseMlPerKg: 20, minutes: 0 })).toThrow(
      'Minutes must be greater than 0.'
    );
  });
});
