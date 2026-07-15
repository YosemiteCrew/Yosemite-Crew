import { assertInRange, assertPositive, roundTo } from '@/app/features/calculators/utils/shared';

export type CorrectedSodiumInput = { measuredNa: number; glucoseMgDl: number };
export type CorrectedSodiumResult = { correctedNa: number };

export const calculateCorrectedSodium = (input: CorrectedSodiumInput): CorrectedSodiumResult => {
  assertInRange(input.measuredNa, 'measuredNa', 'Measured sodium', 100, 200);
  assertPositive(input.glucoseMgDl, 'glucoseMgDl', 'Glucose');
  const correctedNa = input.measuredNa + (1.6 * (input.glucoseMgDl - 100)) / 100;
  return { correctedNa: roundTo(correctedNa, 1) };
};
