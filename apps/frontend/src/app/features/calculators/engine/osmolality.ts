import { assertPositive, roundTo } from '@/app/features/calculators/utils/shared';

export type OsmolalityInput = {
  na: number;
  k: number;
  glucoseMgDl: number;
  bunMgDl: number;
  measuredOsm?: number;
};

export type OsmolalityResult = {
  calculatedOsm: number;
  osmolalGap: number | null;
};

export const calculateOsmolality = (input: OsmolalityInput): OsmolalityResult => {
  assertPositive(input.na, 'na', 'Sodium');
  assertPositive(input.k, 'k', 'Potassium');
  assertPositive(input.glucoseMgDl, 'glucoseMgDl', 'Glucose');
  assertPositive(input.bunMgDl, 'bunMgDl', 'BUN');

  const calculatedOsm = 2 * (input.na + input.k) + input.glucoseMgDl / 18 + input.bunMgDl / 2.8;

  let osmolalGap: number | null = null;
  if (input.measuredOsm !== undefined) {
    assertPositive(input.measuredOsm, 'measuredOsm', 'Measured osmolality');
    osmolalGap = roundTo(input.measuredOsm - calculatedOsm, 1);
  }

  return {
    calculatedOsm: roundTo(calculatedOsm, 1),
    osmolalGap,
  };
};
