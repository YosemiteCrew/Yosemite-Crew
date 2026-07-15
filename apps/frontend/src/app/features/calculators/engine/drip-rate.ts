import { assertPositive, roundTo } from '@/app/features/calculators/utils/shared';

export type DripRateInput = { rateMlPerHr: number; dropFactorGttPerMl?: number };
export type DripRateResult = { dropsPerMin: number; secondsPerDrop: number };

export const calculateDripRate = (input: DripRateInput): DripRateResult => {
  assertPositive(input.rateMlPerHr, 'rateMlPerHr', 'Fluid rate');
  if (input.dropFactorGttPerMl !== undefined) {
    assertPositive(input.dropFactorGttPerMl, 'dropFactorGttPerMl', 'Drop factor');
  }
  const dropFactor = input.dropFactorGttPerMl ?? 20;
  const dropsPerMin = (input.rateMlPerHr * dropFactor) / 60;
  const secondsPerDrop = 60 / dropsPerMin;
  return {
    dropsPerMin: roundTo(dropsPerMin, 0),
    secondsPerDrop: roundTo(secondsPerDrop, 1),
  };
};
