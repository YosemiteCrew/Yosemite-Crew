import { calculateCri } from '@/app/features/calculators/engine/cri';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateCri', () => {
  it('computes the CRI without a drug concentration', () => {
    const result = calculateCri({
      doseMcgPerKgMin: 2,
      weightKg: 10,
      bagVolumeMl: 250,
      fluidRateMlPerHr: 50,
    });

    expect(result.drugPerHourMcg).toBe(1200);
    expect(result.bagDurationHr).toBe(5);
    expect(result.drugToAddMg).toBe(6);
    expect(result.drugVolumeToAddMl).toBeNull();
  });

  it('computes the drug volume to add when a concentration is provided', () => {
    const result = calculateCri({
      doseMcgPerKgMin: 2,
      weightKg: 10,
      bagVolumeMl: 250,
      fluidRateMlPerHr: 50,
      drugConcentrationMgPerMl: 2,
    });

    expect(result.drugVolumeToAddMl).toBe(3);
  });

  it.each([
    [
      'doseMcgPerKgMin',
      { doseMcgPerKgMin: 0, weightKg: 10, bagVolumeMl: 250, fluidRateMlPerHr: 50 },
    ],
    ['weightKg', { doseMcgPerKgMin: 2, weightKg: 0, bagVolumeMl: 250, fluidRateMlPerHr: 50 }],
    ['bagVolumeMl', { doseMcgPerKgMin: 2, weightKg: 10, bagVolumeMl: 0, fluidRateMlPerHr: 50 }],
    [
      'fluidRateMlPerHr',
      { doseMcgPerKgMin: 2, weightKg: 10, bagVolumeMl: 250, fluidRateMlPerHr: 0 },
    ],
  ])('throws when %s is not positive', (_field, input) => {
    expect(() => calculateCri(input)).toThrow(CalculatorInputError);
  });

  it('throws for a non-positive drug concentration', () => {
    expect(() =>
      calculateCri({
        doseMcgPerKgMin: 2,
        weightKg: 10,
        bagVolumeMl: 250,
        fluidRateMlPerHr: 50,
        drugConcentrationMgPerMl: 0,
      })
    ).toThrow(CalculatorInputError);
  });
});
