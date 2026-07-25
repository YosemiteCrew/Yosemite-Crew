import { calculateTransfusion } from '@/app/features/calculators/engine/transfusion';
import { CalculatorInputError } from '@/app/features/calculators/utils/shared';

describe('calculateTransfusion', () => {
  it('computes the transfusion volume for a dog', () => {
    const result = calculateTransfusion({
      species: 'dog',
      weightKg: 10,
      currentPcv: 20,
      targetPcv: 30,
      donorPcv: 40,
    });
    expect(result.transfusionVolumeMl).toBe(225);
  });

  it('uses the cat blood volume constant', () => {
    const result = calculateTransfusion({
      species: 'cat',
      weightKg: 10,
      currentPcv: 20,
      targetPcv: 30,
      donorPcv: 40,
    });
    expect(result.transfusionVolumeMl).toBe(150);
  });

  it('throws for a non-positive weight', () => {
    expect(() =>
      calculateTransfusion({
        species: 'dog',
        weightKg: 0,
        currentPcv: 20,
        targetPcv: 30,
        donorPcv: 40,
      })
    ).toThrow(CalculatorInputError);
  });

  it('throws when currentPcv is out of range', () => {
    expect(() =>
      calculateTransfusion({
        species: 'dog',
        weightKg: 10,
        currentPcv: 0,
        targetPcv: 30,
        donorPcv: 40,
      })
    ).toThrow(CalculatorInputError);
  });

  it('throws when targetPcv is out of range', () => {
    expect(() =>
      calculateTransfusion({
        species: 'dog',
        weightKg: 10,
        currentPcv: 20,
        targetPcv: 71,
        donorPcv: 40,
      })
    ).toThrow(CalculatorInputError);
  });

  it('throws when donorPcv is out of range', () => {
    expect(() =>
      calculateTransfusion({
        species: 'dog',
        weightKg: 10,
        currentPcv: 20,
        targetPcv: 30,
        donorPcv: 81,
      })
    ).toThrow(CalculatorInputError);
  });

  it('throws when target PCV is not greater than current PCV', () => {
    expect(() =>
      calculateTransfusion({
        species: 'dog',
        weightKg: 10,
        currentPcv: 30,
        targetPcv: 30,
        donorPcv: 40,
      })
    ).toThrow('Target PCV must be greater than current PCV.');
  });
});
