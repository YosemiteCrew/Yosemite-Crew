import { calculateFreeWaterDeficit } from '@/app/features/calculators/engine/free-water-deficit';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateFreeWaterDeficit', () => {
  it('computes the free water deficit with the default body water fraction', () => {
    const result = calculateFreeWaterDeficit({ weightKg: 10, currentNa: 160, targetNa: 145 });
    expect(result.freeWaterDeficitL).toBeCloseTo(0.62, 2);
    expect(result.correctionHours).toBe(30);
  });

  it('uses a custom body water fraction', () => {
    const result = calculateFreeWaterDeficit({
      weightKg: 10,
      currentNa: 160,
      targetNa: 145,
      bodyWaterFraction: 0.5,
    });
    expect(result.freeWaterDeficitL).toBeCloseTo(0.52, 2);
  });

  it('throws for a non-positive weight', () => {
    expect(() => calculateFreeWaterDeficit({ weightKg: 0, currentNa: 160, targetNa: 145 })).toThrow(
      CalculatorInputError
    );
  });

  it('throws when currentNa is out of range', () => {
    expect(() => calculateFreeWaterDeficit({ weightKg: 10, currentNa: 99, targetNa: 145 })).toThrow(
      CalculatorInputError
    );
  });

  it('throws when targetNa is out of range', () => {
    expect(() =>
      calculateFreeWaterDeficit({ weightKg: 10, currentNa: 160, targetNa: 201 })
    ).toThrow(CalculatorInputError);
  });

  it('throws when bodyWaterFraction is out of range', () => {
    expect(() =>
      calculateFreeWaterDeficit({
        weightKg: 10,
        currentNa: 160,
        targetNa: 145,
        bodyWaterFraction: 0.9,
      })
    ).toThrow(CalculatorInputError);
  });

  it('throws when target sodium is not below current sodium', () => {
    expect(() =>
      calculateFreeWaterDeficit({ weightKg: 10, currentNa: 145, targetNa: 145 })
    ).toThrow('Target sodium must be below current sodium.');
  });
});
