import { assertPositive, roundTo } from '@/app/features/calculators/utils/shared';

export type ShockBolusInput = {
  weightKg: number;
  doseMlPerKg: number;
  minutes?: number;
};

export type ShockBolusResult = {
  bolusMl: number;
  rateMlPerHr: number;
};

export const calculateShockBolus = (input: ShockBolusInput): ShockBolusResult => {
  assertPositive(input.weightKg, 'weightKg', 'Weight');
  assertPositive(input.doseMlPerKg, 'doseMlPerKg', 'Bolus dose');
  if (input.minutes !== undefined) {
    assertPositive(input.minutes, 'minutes', 'Minutes');
  }
  const mins = input.minutes ?? 15;
  const bolusMl = input.doseMlPerKg * input.weightKg;
  const rateMlPerHr = bolusMl / (mins / 60);
  return {
    bolusMl: roundTo(bolusMl, 0),
    rateMlPerHr: roundTo(rateMlPerHr, 0),
  };
};
