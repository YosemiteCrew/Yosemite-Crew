import {
  CalculatorInputError,
  type CalculatorSpecies,
} from '@/app/features/calculators/utils/shared';

export type GestationInput = { species: CalculatorSpecies; breedingDate: string };
export type GestationResult = { dueDate: string; earliest: string; latest: string };

export const calculateGestation = (input: GestationInput): GestationResult => {
  const base = new Date(input.breedingDate + 'T00:00:00Z');
  if (Number.isNaN(base.getTime())) {
    throw new CalculatorInputError('breedingDate', 'Breeding date is required.');
  }
  const gestationDays = input.species === 'dog' ? 63 : 65;
  const fmt = (offset: number) =>
    new Date(base.getTime() + offset * 86400000).toISOString().slice(0, 10);
  return {
    dueDate: fmt(gestationDays),
    earliest: fmt(gestationDays - 2),
    latest: fmt(gestationDays + 2),
  };
};
