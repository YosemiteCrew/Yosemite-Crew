import { assertPositive, roundTo } from '@/app/features/calculators/utils/shared';

export type AnionGapInput = { na: number; k: number; cl: number; hco3: number };

export type AnionGapResult = { anionGap: number };

export const calculateAnionGap = (input: AnionGapInput): AnionGapResult => {
  assertPositive(input.na, 'na', 'Sodium');
  assertPositive(input.k, 'k', 'Potassium');
  assertPositive(input.cl, 'cl', 'Chloride');
  assertPositive(input.hco3, 'hco3', 'Bicarbonate');
  const anionGap = input.na + input.k - (input.cl + input.hco3);
  return { anionGap: roundTo(anionGap, 1) };
};
