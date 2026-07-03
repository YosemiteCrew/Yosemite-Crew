import { calculateCri } from '@/app/features/calculators/engine/cri';

describe('calculateCri', () => {
  it('computes the full CRI including drug volume when concentration is provided', () => {
    const r = calculateCri({
      doseMcgPerKgMin: 2,
      weightKg: 20,
      bagVolumeMl: 500,
      fluidRateMlPerHr: 10,
      drugConcentrationMgPerMl: 50,
    });
    expect(r.drugPerHourMcg).toBe(2400);
    expect(r.bagDurationHr).toBe(50);
    expect(r.drugToAddMg).toBe(120);
    expect(r.drugVolumeToAddMl).toBeCloseTo(2.4, 2);
  });

  it('returns null drug volume when concentration is absent', () => {
    const r = calculateCri({
      doseMcgPerKgMin: 5,
      weightKg: 10,
      bagVolumeMl: 250,
      fluidRateMlPerHr: 5,
    });
    expect(r.drugToAddMg).toBe(150);
    expect(r.drugVolumeToAddMl).toBeNull();
  });

  it('rejects a non-positive dose', () => {
    expect(() =>
      calculateCri({
        doseMcgPerKgMin: 0,
        weightKg: 20,
        bagVolumeMl: 500,
        fluidRateMlPerHr: 10,
      })
    ).toThrow('Dose must be greater than 0.');
  });

  it('rejects a non-positive weight', () => {
    expect(() =>
      calculateCri({
        doseMcgPerKgMin: 2,
        weightKg: 0,
        bagVolumeMl: 500,
        fluidRateMlPerHr: 10,
      })
    ).toThrow('Weight must be greater than 0.');
  });

  it('rejects a non-positive bag volume', () => {
    expect(() =>
      calculateCri({
        doseMcgPerKgMin: 2,
        weightKg: 20,
        bagVolumeMl: 0,
        fluidRateMlPerHr: 10,
      })
    ).toThrow('Bag volume must be greater than 0.');
  });

  it('rejects a non-positive fluid rate', () => {
    expect(() =>
      calculateCri({
        doseMcgPerKgMin: 2,
        weightKg: 20,
        bagVolumeMl: 500,
        fluidRateMlPerHr: 0,
      })
    ).toThrow('Fluid rate must be greater than 0.');
  });

  it('rejects a non-positive drug concentration when provided', () => {
    expect(() =>
      calculateCri({
        doseMcgPerKgMin: 2,
        weightKg: 20,
        bagVolumeMl: 500,
        fluidRateMlPerHr: 10,
        drugConcentrationMgPerMl: 0,
      })
    ).toThrow('Drug concentration must be greater than 0.');
  });
});
