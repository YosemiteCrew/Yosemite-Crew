import { assertPositive, roundTo } from '@/app/features/calculators/utils/shared';

export type CorrectedCalciumInput = { totalCalciumMgDl: number; albuminGdl: number };

export type CorrectedCalciumResult = { correctedCalcium: number };

export const calculateCorrectedCalcium = (input: CorrectedCalciumInput): CorrectedCalciumResult => {
  assertPositive(input.totalCalciumMgDl, 'totalCalciumMgDl', 'Total calcium');
  assertPositive(input.albuminGdl, 'albuminGdl', 'Albumin');
  const correctedCalcium = input.totalCalciumMgDl - input.albuminGdl + 3.5;
  return { correctedCalcium: roundTo(correctedCalcium, 1) };
};
