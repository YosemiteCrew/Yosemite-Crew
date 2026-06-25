import type { CalculatorSpecies } from '@/app/features/calculators/utils/calculations';

export type CalculatorKey = 'fluid-rate' | 'drug-dose' | 'body-surface-area';

export const SPECIES_OPTIONS: ReadonlyArray<{ label: string; value: CalculatorSpecies }> = [
  { label: 'Dog', value: 'dog' },
  { label: 'Cat', value: 'cat' },
];

export const CALCULATOR_TABS: ReadonlyArray<{ label: string; value: CalculatorKey }> = [
  { label: 'Fluid rate', value: 'fluid-rate' },
  { label: 'Drug dose', value: 'drug-dose' },
  { label: 'Body surface area', value: 'body-surface-area' },
];

// Clinical decision support: shown on every calculator. These tools are aids and
// do not replace clinical judgement.
export const CLINICAL_DISCLAIMER =
  'For clinical decision support only. Verify every result against current ' +
  'references and the patient before use. Dog and cat formulas only.';
