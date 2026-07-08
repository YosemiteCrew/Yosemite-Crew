import {
  assertPositive,
  assertInRange,
  roundTo,
  CalculatorInputError,
  type CalculatorSpecies,
} from '@/app/features/calculators/utils/shared';

export type TransfusionInput = {
  species: CalculatorSpecies;
  weightKg: number;
  currentPcv: number;
  targetPcv: number;
  donorPcv: number;
};

export type TransfusionResult = {
  transfusionVolumeMl: number;
};

export const calculateTransfusion = (input: TransfusionInput): TransfusionResult => {
  assertPositive(input.weightKg, 'weightKg', 'Weight');
  assertInRange(input.currentPcv, 'currentPcv', 'Current PCV', 1, 70);
  assertInRange(input.targetPcv, 'targetPcv', 'Target PCV', 1, 70);
  assertInRange(input.donorPcv, 'donorPcv', 'Donor PCV', 1, 80);

  if (input.targetPcv <= input.currentPcv) {
    throw new CalculatorInputError('targetPcv', 'Target PCV must be greater than current PCV.');
  }

  const bloodVolume = input.species === 'dog' ? 90 : 60;
  const transfusionVolumeMl =
    (bloodVolume * input.weightKg * (input.targetPcv - input.currentPcv)) / input.donorPcv;

  return { transfusionVolumeMl: roundTo(transfusionVolumeMl, 0) };
};
