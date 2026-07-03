import { calculateDripRate } from '@/app/features/calculators/engine/drip-rate';

describe('calculateDripRate', () => {
  it('computes drops per minute and seconds per drop with an explicit drop factor', () => {
    const r = calculateDripRate({ rateMlPerHr: 120, dropFactorGttPerMl: 20 });
    expect(r.dropsPerMin).toBe(40);
    expect(r.secondsPerDrop).toBeCloseTo(1.5, 1);
  });

  it('computes the second worked example with a micro-drip drop factor', () => {
    const r = calculateDripRate({ rateMlPerHr: 30, dropFactorGttPerMl: 60 });
    expect(r.dropsPerMin).toBe(30);
    expect(r.secondsPerDrop).toBeCloseTo(2, 1);
  });

  it('defaults the drop factor to 20 when it is omitted', () => {
    const r = calculateDripRate({ rateMlPerHr: 120 });
    expect(r.dropsPerMin).toBe(40);
    expect(r.secondsPerDrop).toBeCloseTo(1.5, 1);
  });

  it('rejects a non-positive fluid rate', () => {
    expect(() => calculateDripRate({ rateMlPerHr: 0 })).toThrow(
      'Fluid rate must be greater than 0.'
    );
  });

  it('rejects a non-positive drop factor when provided', () => {
    expect(() => calculateDripRate({ rateMlPerHr: 120, dropFactorGttPerMl: 0 })).toThrow(
      'Drop factor must be greater than 0.'
    );
  });
});
