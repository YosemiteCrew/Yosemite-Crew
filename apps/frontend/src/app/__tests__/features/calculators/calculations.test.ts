import {
  BSA_K_FACTOR,
  MAINTENANCE_ML_PER_KG_PER_DAY,
  CalculatorInputError,
  calculateBodySurfaceArea,
  calculateDrugDose,
  calculateFluidRate,
} from '@/app/features/calculators/utils/calculations';

describe('calculateFluidRate', () => {
  it('computes maintenance, deficit and rate for a dog', () => {
    const result = calculateFluidRate({ species: 'dog', weightKg: 10, dehydrationPercent: 5 });

    expect(result.maintenanceMlPerDay).toBe(600);
    expect(result.deficitMl).toBe(500);
    expect(result.ongoingLossesMlPerDay).toBe(0);
    expect(result.totalMlPerDay).toBe(1100);
    expect(result.ratePerHourMl).toBeCloseTo(45.8, 1);
  });

  it('uses the cat maintenance factor and allows zero dehydration', () => {
    const result = calculateFluidRate({ species: 'cat', weightKg: 4, dehydrationPercent: 0 });

    expect(result.maintenanceMlPerDay).toBe(200);
    expect(result.deficitMl).toBe(0);
    expect(result.totalMlPerDay).toBe(200);
  });

  it('adds ongoing losses when provided', () => {
    const result = calculateFluidRate({
      species: 'dog',
      weightKg: 10,
      dehydrationPercent: 5,
      ongoingLossesMlPerDay: 100,
    });

    expect(result.ongoingLossesMlPerDay).toBe(100);
    expect(result.totalMlPerDay).toBe(1200);
    expect(result.ratePerHourMl).toBeCloseTo(50, 1);
  });

  it('rejects a missing weight', () => {
    expect(() =>
      calculateFluidRate({ species: 'dog', weightKg: Number.NaN, dehydrationPercent: 5 })
    ).toThrow('Weight is required.');
  });

  it('rejects a non-positive weight', () => {
    expect(() =>
      calculateFluidRate({ species: 'dog', weightKg: 0, dehydrationPercent: 5 })
    ).toThrow('Weight must be greater than 0.');
  });

  it.each([-1, 16])('rejects out-of-range dehydration (%s)', (dehydrationPercent) => {
    expect(() => calculateFluidRate({ species: 'dog', weightKg: 10, dehydrationPercent })).toThrow(
      'Dehydration must be between 0 and 15.'
    );
  });

  it('rejects negative ongoing losses with the right field', () => {
    try {
      calculateFluidRate({
        species: 'dog',
        weightKg: 10,
        dehydrationPercent: 5,
        ongoingLossesMlPerDay: -5,
      });
      throw new Error('expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CalculatorInputError);
      expect((error as CalculatorInputError).field).toBe('ongoingLossesMlPerDay');
      expect((error as CalculatorInputError).message).toBe('Ongoing losses cannot be negative.');
    }
  });
});

describe('calculateDrugDose', () => {
  it('computes dose per administration and defaults frequency to once daily', () => {
    const result = calculateDrugDose({ weightKg: 10, doseMgPerKg: 5 });

    expect(result.doseMgPerAdministration).toBe(50);
    expect(result.frequencyPerDay).toBe(1);
    expect(result.dailyDoseMg).toBe(50);
    expect(result.volumeMlPerAdministration).toBeNull();
  });

  it('computes the volume to draw up from a concentration', () => {
    const result = calculateDrugDose({
      weightKg: 10,
      doseMgPerKg: 5,
      concentrationMgPerMl: 10,
    });

    expect(result.volumeMlPerAdministration).toBe(5);
  });

  it('multiplies the daily dose by the frequency', () => {
    const result = calculateDrugDose({ weightKg: 10, doseMgPerKg: 5, frequencyPerDay: 3 });

    expect(result.dailyDoseMg).toBe(150);
  });

  it('rejects a non-positive dose', () => {
    expect(() => calculateDrugDose({ weightKg: 10, doseMgPerKg: 0 })).toThrow(
      'Dose must be greater than 0.'
    );
  });

  it('rejects a non-positive frequency', () => {
    expect(() => calculateDrugDose({ weightKg: 10, doseMgPerKg: 5, frequencyPerDay: 0 })).toThrow(
      'Frequency must be greater than 0.'
    );
  });

  it('rejects a non-positive concentration', () => {
    expect(() =>
      calculateDrugDose({ weightKg: 10, doseMgPerKg: 5, concentrationMgPerMl: 0 })
    ).toThrow('Concentration must be greater than 0.');
  });
});

describe('calculateBodySurfaceArea', () => {
  it('computes BSA for a dog', () => {
    const result = calculateBodySurfaceArea({ species: 'dog', weightKg: 10 });

    expect(result.bsaM2).toBeCloseTo(0.469, 3);
    expect(result.totalDoseMg).toBeNull();
  });

  it('computes BSA for a cat using the cat K factor', () => {
    const result = calculateBodySurfaceArea({ species: 'cat', weightKg: 10 });

    expect(result.bsaM2).toBeCloseTo(0.464, 3);
  });

  it('computes a BSA-normalised dose when dosePerM2 is provided', () => {
    const result = calculateBodySurfaceArea({ species: 'dog', weightKg: 10, dosePerM2: 50 });

    expect(result.totalDoseMg).toBeCloseTo(23.44, 2);
  });

  it('rejects a non-positive weight', () => {
    expect(() => calculateBodySurfaceArea({ species: 'dog', weightKg: 0 })).toThrow(
      'Weight must be greater than 0.'
    );
  });

  it('rejects a non-positive dose per m²', () => {
    expect(() => calculateBodySurfaceArea({ species: 'dog', weightKg: 10, dosePerM2: -1 })).toThrow(
      'Dose per m² must be greater than 0.'
    );
  });
});

describe('calculator constants', () => {
  it('exposes species factors', () => {
    expect(MAINTENANCE_ML_PER_KG_PER_DAY.dog).toBe(60);
    expect(MAINTENANCE_ML_PER_KG_PER_DAY.cat).toBe(50);
    expect(BSA_K_FACTOR.dog).toBe(10.1);
    expect(BSA_K_FACTOR.cat).toBe(10.0);
  });
});
