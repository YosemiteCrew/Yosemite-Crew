import { calculateOxygenFlow } from '@/app/features/calculators/engine/oxygen-flow';

describe('calculateOxygenFlow', () => {
  it('computes flow with an explicit flow per kg', () => {
    const r = calculateOxygenFlow({ weightKg: 10, flowMlPerKgPerMin: 100 });
    expect(r.flowMlPerMin).toBe(1000);
    expect(r.flowLPerMin).toBe(1);
  });

  it('defaults flow per kg to 100 when absent', () => {
    const r = calculateOxygenFlow({ weightKg: 5 });
    expect(r.flowMlPerMin).toBe(500);
    expect(r.flowLPerMin).toBeCloseTo(0.5, 2);
  });

  it('rejects a non-positive weight', () => {
    expect(() => calculateOxygenFlow({ weightKg: 0 })).toThrow('Weight must be greater than 0.');
  });

  it('rejects a non-positive flow per kg when provided', () => {
    expect(() => calculateOxygenFlow({ weightKg: 10, flowMlPerKgPerMin: 0 })).toThrow(
      'Flow per kg must be greater than 0.'
    );
  });
});
