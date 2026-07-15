import { assertPositive, roundTo } from '@/app/features/calculators/utils/shared';

export type ConcentrationInput = { percentSolution: number; doseMg?: number };

export type ConcentrationResult = { concentrationMgPerMl: number; volumeMl: number | null };

export const calculateConcentration = (input: ConcentrationInput): ConcentrationResult => {
  assertPositive(input.percentSolution, 'percentSolution', 'Solution strength');
  const concentrationMgPerMl = input.percentSolution * 10;
  let volumeMl: number | null = null;
  if (input.doseMg !== undefined) {
    assertPositive(input.doseMg, 'doseMg', 'Dose');
    volumeMl = roundTo(input.doseMg / concentrationMgPerMl, 2);
  }
  return { concentrationMgPerMl: roundTo(concentrationMgPerMl, 2), volumeMl };
};
