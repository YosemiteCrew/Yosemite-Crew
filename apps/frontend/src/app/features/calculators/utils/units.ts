// Pet weights are recorded in pounds in the workspace; the calculators use
// kilograms, so weight pre-filled from a patient is converted here.
const POUNDS_PER_KILOGRAM = 2.20462;

export const lbsToKg = (lbs: number): number => Math.round((lbs / POUNDS_PER_KILOGRAM) * 100) / 100;
