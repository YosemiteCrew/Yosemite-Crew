import { calculateConcentration } from '@/app/features/calculators/engine/concentration';

describe('calculateConcentration', () => {
  it('computes concentration and volume for a dose', () => {
    const r = calculateConcentration({ percentSolution: 2, doseMg: 50 });
    expect(r.concentrationMgPerMl).toBe(20);
    expect(r.volumeMl).toBeCloseTo(2.5, 2);
  });

  it('returns null volume when no dose is provided', () => {
    const r = calculateConcentration({ percentSolution: 0.9 });
    expect(r.concentrationMgPerMl).toBe(9);
    expect(r.volumeMl).toBeNull();
  });

  it('rejects a non-positive solution strength', () => {
    expect(() => calculateConcentration({ percentSolution: 0 })).toThrow(
      'Solution strength must be greater than 0.'
    );
  });

  it('rejects a non-positive dose when provided', () => {
    expect(() => calculateConcentration({ percentSolution: 2, doseMg: 0 })).toThrow(
      'Dose must be greater than 0.'
    );
  });
});
