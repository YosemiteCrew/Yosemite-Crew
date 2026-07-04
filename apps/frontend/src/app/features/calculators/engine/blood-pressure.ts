import { assertPositive } from '@/app/features/calculators/utils/shared';

export type BloodPressureInput = { sbpMmHg: number };
export type BloodPressureResult = { category: string; risk: string };

export const classifyBloodPressure = (input: BloodPressureInput): BloodPressureResult => {
  assertPositive(input.sbpMmHg, 'sbpMmHg', 'Systolic blood pressure');

  let category: string;
  let risk: string;
  if (input.sbpMmHg < 140) {
    category = 'Normotensive';
    risk = 'Minimal';
  } else if (input.sbpMmHg < 160) {
    category = 'Prehypertensive';
    risk = 'Low';
  } else if (input.sbpMmHg < 180) {
    category = 'Hypertensive';
    risk = 'Moderate';
  } else {
    category = 'Severely hypertensive';
    risk = 'High';
  }

  return { category, risk };
};
