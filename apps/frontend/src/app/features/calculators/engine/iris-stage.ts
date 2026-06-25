import { assertPositive, type CalculatorSpecies } from '@/app/features/calculators/utils/shared';

export type IrisStageInput = { species: CalculatorSpecies; creatinineMgDl: number };
export type IrisStageResult = { stage: number; interpretation: string };

export const calculateIrisStage = (input: IrisStageInput): IrisStageResult => {
  assertPositive(input.creatinineMgDl, 'creatinineMgDl', 'Creatinine');
  const stage1Max = input.species === 'dog' ? 1.4 : 1.6;
  let stage: number;
  if (input.creatinineMgDl < stage1Max) {
    stage = 1;
  } else if (input.creatinineMgDl <= 2.8) {
    stage = 2;
  } else if (input.creatinineMgDl <= 5.0) {
    stage = 3;
  } else {
    stage = 4;
  }
  const interpretation = [
    'Nonazotemic',
    'Mild renal azotemia',
    'Moderate renal azotemia',
    'Severe renal azotemia',
  ][stage - 1];
  return { stage, interpretation };
};
