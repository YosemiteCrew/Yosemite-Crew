import { assertPositive, roundTo } from '@/app/features/calculators/utils/shared';

export type CriInput = {
  doseMcgPerKgMin: number;
  weightKg: number;
  bagVolumeMl: number;
  fluidRateMlPerHr: number;
  drugConcentrationMgPerMl?: number;
};

export type CriResult = {
  drugPerHourMcg: number;
  bagDurationHr: number;
  drugToAddMg: number;
  drugVolumeToAddMl: number | null;
};

export const calculateCri = (input: CriInput): CriResult => {
  assertPositive(input.doseMcgPerKgMin, 'doseMcgPerKgMin', 'Dose');
  assertPositive(input.weightKg, 'weightKg', 'Weight');
  assertPositive(input.bagVolumeMl, 'bagVolumeMl', 'Bag volume');
  assertPositive(input.fluidRateMlPerHr, 'fluidRateMlPerHr', 'Fluid rate');

  const drugPerHourMcg = input.doseMcgPerKgMin * input.weightKg * 60;
  const bagDurationHr = input.bagVolumeMl / input.fluidRateMlPerHr;
  const drugToAddMcg = drugPerHourMcg * bagDurationHr;
  const drugToAddMg = drugToAddMcg / 1000;

  let drugVolumeToAddMl: number | null = null;
  if (input.drugConcentrationMgPerMl !== undefined) {
    assertPositive(
      input.drugConcentrationMgPerMl,
      'drugConcentrationMgPerMl',
      'Drug concentration'
    );
    drugVolumeToAddMl = roundTo(drugToAddMg / input.drugConcentrationMgPerMl, 2);
  }

  return {
    drugPerHourMcg: roundTo(drugPerHourMcg, 1),
    bagDurationHr: roundTo(bagDurationHr, 2),
    drugToAddMg: roundTo(drugToAddMg, 2),
    drugVolumeToAddMl,
  };
};
