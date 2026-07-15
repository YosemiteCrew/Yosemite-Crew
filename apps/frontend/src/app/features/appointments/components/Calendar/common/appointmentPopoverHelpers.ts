import { Appointment } from '@yosemite-crew/types';

export type CompanionWeightSource = Appointment['companion'] & {
  currentWeight?: number | string;
  physicalAttribute?: { weight?: string };
};

export type PopoverCompanion = NonNullable<Appointment['companion']> | Appointment['patient'];

export const SPECIES_DISPLAY: Record<string, string> = {
  dog: 'Canine',
  cat: 'Feline',
  horse: 'Equine',
  other: 'Other',
};

export const getCompanionGenderLabel = (gender?: string, isneutered?: boolean): string => {
  if (gender === 'male') return isneutered ? 'MN' : 'Male';
  if (gender === 'female') return isneutered ? 'FS' : 'Female';
  return 'Unknown';
};

export const getCompanionAge = (dateOfBirth?: Date): string => {
  if (!dateOfBirth) return '';
  const dob = new Date(dateOfBirth);
  const now = new Date();
  const years = now.getFullYear() - dob.getFullYear();
  const months = now.getMonth() - dob.getMonth() + (now.getDate() < dob.getDate() ? -1 : 0);
  const totalMonths = years * 12 + months;
  if (totalMonths < 1) return '< 1m';
  if (totalMonths < 12) return `${totalMonths}m`;
  const wholeYears = Math.floor(totalMonths / 12);
  const remMonths = totalMonths % 12;
  return remMonths > 0 ? `${wholeYears}y ${remMonths}m` : `${wholeYears}y`;
};

export const getCompanionWeightLabel = (companion: CompanionWeightSource): string => {
  const weight = companion.currentWeight;
  if (weight === undefined || weight === null || weight === '') {
    return '';
  }
  const numericWeight = typeof weight === 'number' ? weight : Number(weight);
  if (Number.isFinite(numericWeight) && numericWeight > 0) {
    return `${Number.isInteger(numericWeight) ? numericWeight : numericWeight.toFixed(1)} kg`;
  }
  const physicalWeight = companion.physicalAttribute?.weight?.trim();
  return physicalWeight || '';
};
