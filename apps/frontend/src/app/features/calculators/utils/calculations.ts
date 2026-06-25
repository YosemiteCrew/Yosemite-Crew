// Pure, dependency-free veterinary calculation engine.
// Formulas are standard, citable clinical references and are deliberately kept
// side-effect free so they can be unit-tested in isolation and later promoted to
// a shared package for backend persistence (see issue #1661).

import {
  assertInRange,
  assertNonNegative,
  assertPositive,
  roundTo,
  type CalculatorSpecies,
} from '@/app/features/calculators/utils/shared';

export { CalculatorInputError } from '@/app/features/calculators/utils/shared';
export type { CalculatorSpecies } from '@/app/features/calculators/utils/shared';

// ---------------------------------------------------------------------------
// Fluid rate (maintenance + dehydration deficit)
// Maintenance: ~60 mL/kg/day (dog), ~50 mL/kg/day (cat).
// Deficit (mL) = body weight (kg) x (% dehydration / 100) x 1000.
// Deficit is replaced alongside maintenance over 24h.
// ---------------------------------------------------------------------------

export const MAINTENANCE_ML_PER_KG_PER_DAY: Record<CalculatorSpecies, number> = {
  dog: 60,
  cat: 50,
};

export const MAX_DEHYDRATION_PERCENT = 15;

export type FluidRateInput = {
  species: CalculatorSpecies;
  weightKg: number;
  dehydrationPercent: number;
  ongoingLossesMlPerDay?: number;
};

export type FluidRateResult = {
  maintenanceMlPerDay: number;
  deficitMl: number;
  ongoingLossesMlPerDay: number;
  totalMlPerDay: number;
  ratePerHourMl: number;
};

export const calculateFluidRate = (input: FluidRateInput): FluidRateResult => {
  assertPositive(input.weightKg, 'weightKg', 'Weight');
  assertInRange(
    input.dehydrationPercent,
    'dehydrationPercent',
    'Dehydration',
    0,
    MAX_DEHYDRATION_PERCENT
  );

  const ongoingLosses = input.ongoingLossesMlPerDay ?? 0;
  assertNonNegative(ongoingLosses, 'ongoingLossesMlPerDay', 'Ongoing losses');

  const maintenanceMlPerDay = MAINTENANCE_ML_PER_KG_PER_DAY[input.species] * input.weightKg;
  const deficitMl = input.weightKg * (input.dehydrationPercent / 100) * 1000;
  const totalMlPerDay = maintenanceMlPerDay + deficitMl + ongoingLosses;

  return {
    maintenanceMlPerDay: roundTo(maintenanceMlPerDay, 1),
    deficitMl: roundTo(deficitMl, 1),
    ongoingLossesMlPerDay: roundTo(ongoingLosses, 1),
    totalMlPerDay: roundTo(totalMlPerDay, 1),
    ratePerHourMl: roundTo(totalMlPerDay / 24, 1),
  };
};

// ---------------------------------------------------------------------------
// Drug dose (mg/kg) and volume to draw up
// Dose per administration (mg) = dose rate (mg/kg) x weight (kg).
// Volume (mL) = dose (mg) / concentration (mg/mL), when a concentration is given.
// ---------------------------------------------------------------------------

export type DrugDoseInput = {
  weightKg: number;
  doseMgPerKg: number;
  concentrationMgPerMl?: number;
  frequencyPerDay?: number;
};

export type DrugDoseResult = {
  doseMgPerAdministration: number;
  frequencyPerDay: number;
  dailyDoseMg: number;
  volumeMlPerAdministration: number | null;
};

export const calculateDrugDose = (input: DrugDoseInput): DrugDoseResult => {
  assertPositive(input.weightKg, 'weightKg', 'Weight');
  assertPositive(input.doseMgPerKg, 'doseMgPerKg', 'Dose');

  const frequency = input.frequencyPerDay ?? 1;
  assertPositive(frequency, 'frequencyPerDay', 'Frequency');

  const doseMgPerAdministration = input.doseMgPerKg * input.weightKg;
  const dailyDoseMg = doseMgPerAdministration * frequency;

  let volumeMlPerAdministration: number | null = null;
  if (input.concentrationMgPerMl !== undefined) {
    assertPositive(input.concentrationMgPerMl, 'concentrationMgPerMl', 'Concentration');
    volumeMlPerAdministration = roundTo(doseMgPerAdministration / input.concentrationMgPerMl, 2);
  }

  return {
    doseMgPerAdministration: roundTo(doseMgPerAdministration, 2),
    frequencyPerDay: frequency,
    dailyDoseMg: roundTo(dailyDoseMg, 2),
    volumeMlPerAdministration,
  };
};

// ---------------------------------------------------------------------------
// Body surface area (BSA) and BSA-based dosing
// BSA (m^2) = K x weight(g)^(2/3) / 10000, with K = 10.1 (dog), 10.0 (cat).
// Used for chemotherapy and other BSA-normalised dosing.
// ---------------------------------------------------------------------------

export const BSA_K_FACTOR: Record<CalculatorSpecies, number> = {
  dog: 10.1,
  cat: 10.0,
};

export type BodySurfaceAreaInput = {
  species: CalculatorSpecies;
  weightKg: number;
  dosePerM2?: number;
};

export type BodySurfaceAreaResult = {
  bsaM2: number;
  totalDoseMg: number | null;
};

export const calculateBodySurfaceArea = (input: BodySurfaceAreaInput): BodySurfaceAreaResult => {
  assertPositive(input.weightKg, 'weightKg', 'Weight');

  const weightGrams = input.weightKg * 1000;
  const bsaM2 = (BSA_K_FACTOR[input.species] * weightGrams ** (2 / 3)) / 10000;

  let totalDoseMg: number | null = null;
  if (input.dosePerM2 !== undefined) {
    assertPositive(input.dosePerM2, 'dosePerM2', 'Dose per m²');
    totalDoseMg = roundTo(input.dosePerM2 * bsaM2, 2);
  }

  return {
    bsaM2: roundTo(bsaM2, 3),
    totalDoseMg,
  };
};
