import { assertPositive, roundTo } from '@/app/features/calculators/utils/shared';

export type EnergyInput = {
  weightKg: number;
  merFactor?: number;
  dietKcalPer100g?: number;
};

export type EnergyResult = {
  rerKcalPerDay: number;
  merKcalPerDay: number;
  gramsPerDay: number | null;
};

export const calculateEnergyRequirement = (input: EnergyInput): EnergyResult => {
  assertPositive(input.weightKg, 'weightKg', 'Weight');
  if (input.merFactor !== undefined) {
    assertPositive(input.merFactor, 'merFactor', 'MER factor');
  }
  if (input.dietKcalPer100g !== undefined) {
    assertPositive(input.dietKcalPer100g, 'dietKcalPer100g', 'Diet energy');
  }

  const factor = input.merFactor ?? 1.6;
  const rer = 70 * input.weightKg ** 0.75;
  const mer = rer * factor;
  const gramsPerDay =
    input.dietKcalPer100g !== undefined ? roundTo(mer / (input.dietKcalPer100g / 100), 0) : null;

  return {
    rerKcalPerDay: roundTo(rer, 0),
    merKcalPerDay: roundTo(mer, 0),
    gramsPerDay,
  };
};
