import {
  assertPositive,
  assertInRange,
  roundTo,
  CalculatorInputError,
} from '@/app/features/calculators/utils/shared';

export type FreeWaterDeficitInput = {
  weightKg: number;
  currentNa: number;
  targetNa: number;
  bodyWaterFraction?: number;
};

export type FreeWaterDeficitResult = {
  freeWaterDeficitL: number;
  correctionHours: number;
};

export const calculateFreeWaterDeficit = (input: FreeWaterDeficitInput): FreeWaterDeficitResult => {
  assertPositive(input.weightKg, 'weightKg', 'Weight');
  assertInRange(input.currentNa, 'currentNa', 'Current sodium', 100, 200);
  assertInRange(input.targetNa, 'targetNa', 'Target sodium', 100, 200);
  if (input.bodyWaterFraction !== undefined) {
    assertPositive(input.bodyWaterFraction, 'bodyWaterFraction', 'Body water fraction');
  }
  if (input.targetNa >= input.currentNa) {
    throw new CalculatorInputError('targetNa', 'Target sodium must be below current sodium.');
  }

  const fraction = input.bodyWaterFraction ?? 0.6;
  const freeWaterDeficitL = fraction * input.weightKg * (input.currentNa / input.targetNa - 1);
  const correctionHours = (input.currentNa - input.targetNa) / 0.5;

  return {
    freeWaterDeficitL: roundTo(freeWaterDeficitL, 2),
    correctionHours: roundTo(correctionHours, 0),
  };
};
