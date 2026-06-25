import type { CalculatorSpecies } from '@/app/features/calculators/utils/shared';

export const SPECIES_OPTIONS: ReadonlyArray<{ label: string; value: CalculatorSpecies }> = [
  { label: 'Dog', value: 'dog' },
  { label: 'Cat', value: 'cat' },
];

// Clinical decision support: shown on every calculator. These tools are aids and
// do not replace clinical judgement.
export const CLINICAL_DISCLAIMER =
  'For clinical decision support only. Verify every result against current ' +
  'references and the patient before use. Dog and cat formulas only.';
