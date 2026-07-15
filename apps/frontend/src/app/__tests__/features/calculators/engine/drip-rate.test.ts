import { calculateDripRate } from '@/app/features/calculators/engine/drip-rate';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateDripRate', () => {
  it('uses the default drop factor of 20 when none is provided', () => {
    const result = calculateDripRate({ rateMlPerHr: 60 });
    expect(result.dropsPerMin).toBe(20);
    expect(result.secondsPerDrop).toBe(3);
  });

  it('uses a custom drop factor when provided', () => {
    const result = calculateDripRate({ rateMlPerHr: 60, dropFactorGttPerMl: 15 });
    expect(result.dropsPerMin).toBe(15);
  });

  it('throws for a non-positive rate', () => {
    expect(() => calculateDripRate({ rateMlPerHr: 0 })).toThrow(CalculatorInputError);
  });

  it('throws for a non-positive drop factor', () => {
    expect(() => calculateDripRate({ rateMlPerHr: 60, dropFactorGttPerMl: 0 })).toThrow(
      CalculatorInputError
    );
  });
});
