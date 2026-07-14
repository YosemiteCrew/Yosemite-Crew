import type { CalculatorSpecies } from '@/app/features/calculators/utils/shared';

// User-facing labels use the clinical terms (canine/feline); the engine value
// stays dog/cat.
export const SPECIES_OPTIONS: ReadonlyArray<{ label: string; value: CalculatorSpecies }> = [
  { label: 'Canine', value: 'dog' },
  { label: 'Feline', value: 'cat' },
];

// Clinical decision support: shown on every calculator. These tools are aids and
// do not replace clinical judgement.
export const CLINICAL_DISCLAIMER =
  'For clinical decision support only. Verify every result against current ' +
  'references and the patient before use. Canine and feline formulas only.';
