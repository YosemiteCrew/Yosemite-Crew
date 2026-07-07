import { calculateOxygenFlow } from '@/app/features/calculators/engine/oxygen-flow';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateOxygenFlow', () => {
  it('uses the default flow rate of 100 ml/kg/min when none is provided', () => {
    const result = calculateOxygenFlow({ weightKg: 10 });
    expect(result.flowMlPerMin).toBe(1000);
    expect(result.flowLPerMin).toBe(1);
  });

  it('uses a custom flow rate when provided', () => {
    const result = calculateOxygenFlow({ weightKg: 10, flowMlPerKgPerMin: 50 });
    expect(result.flowMlPerMin).toBe(500);
    expect(result.flowLPerMin).toBe(0.5);
  });

  it('throws for a non-positive weight', () => {
    expect(() => calculateOxygenFlow({ weightKg: 0 })).toThrow(CalculatorInputError);
  });

  it('throws for a non-positive flow rate', () => {
    expect(() => calculateOxygenFlow({ weightKg: 10, flowMlPerKgPerMin: 0 })).toThrow(
      CalculatorInputError
    );
  });
});
