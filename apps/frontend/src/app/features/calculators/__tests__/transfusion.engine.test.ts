import { calculateTransfusion } from '@/app/features/calculators/engine/transfusion';

describe('calculateTransfusion', () => {
  it('computes whole-blood volume for a dog', () => {
    const r = calculateTransfusion({
      species: 'dog',
      weightKg: 20,
      currentPcv: 15,
      targetPcv: 25,
      donorPcv: 40,
    });
    expect(r.transfusionVolumeMl).toBe(450);
  });

  it('computes whole-blood volume for a cat (rounded to 0dp)', () => {
    const r = calculateTransfusion({
      species: 'cat',
      weightKg: 4,
      currentPcv: 12,
      targetPcv: 20,
      donorPcv: 35,
    });
    expect(r.transfusionVolumeMl).toBeCloseTo(55, 0);
  });

  it('rejects a non-positive weight', () => {
    expect(() =>
      calculateTransfusion({
        species: 'dog',
        weightKg: 0,
        currentPcv: 15,
        targetPcv: 25,
        donorPcv: 40,
      })
    ).toThrow('Weight must be greater than 0.');
  });

  it('rejects a current PCV out of range', () => {
    expect(() =>
      calculateTransfusion({
        species: 'dog',
        weightKg: 20,
        currentPcv: 0,
        targetPcv: 25,
        donorPcv: 40,
      })
    ).toThrow('Current PCV must be between 1 and 70.');
  });

  it('rejects a target PCV out of range', () => {
    expect(() =>
      calculateTransfusion({
        species: 'dog',
        weightKg: 20,
        currentPcv: 15,
        targetPcv: 71,
        donorPcv: 40,
      })
    ).toThrow('Target PCV must be between 1 and 70.');
  });

  it('rejects a donor PCV out of range', () => {
    expect(() =>
      calculateTransfusion({
        species: 'dog',
        weightKg: 20,
        currentPcv: 15,
        targetPcv: 25,
        donorPcv: 81,
      })
    ).toThrow('Donor PCV must be between 1 and 80.');
  });

  it('rejects a target PCV not greater than current PCV', () => {
    expect(() =>
      calculateTransfusion({
        species: 'dog',
        weightKg: 20,
        currentPcv: 15,
        targetPcv: 10,
        donorPcv: 40,
      })
    ).toThrow('Target PCV must be greater than current PCV.');
  });
});
