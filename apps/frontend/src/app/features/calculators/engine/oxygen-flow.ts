import { assertPositive, roundTo } from '@/app/features/calculators/utils/shared';

export type OxygenFlowInput = { weightKg: number; flowMlPerKgPerMin?: number };
export type OxygenFlowResult = { flowMlPerMin: number; flowLPerMin: number };

export const calculateOxygenFlow = (input: OxygenFlowInput): OxygenFlowResult => {
  assertPositive(input.weightKg, 'weightKg', 'Weight');
  if (input.flowMlPerKgPerMin !== undefined) {
    assertPositive(input.flowMlPerKgPerMin, 'flowMlPerKgPerMin', 'Flow per kg');
  }
  const perKg = input.flowMlPerKgPerMin ?? 100;
  const flowMlPerMin = perKg * input.weightKg;
  const flowLPerMin = flowMlPerMin / 1000;
  return {
    flowMlPerMin: roundTo(flowMlPerMin, 0),
    flowLPerMin: roundTo(flowLPerMin, 2),
  };
};
