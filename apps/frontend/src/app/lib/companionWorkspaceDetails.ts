import type { StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import type { CompanionDetail } from '@/app/features/appointments/pages/AppointmentWorkspace/CompanionContextCard';
import { formatDisplayDate, getAgeInYears } from '@/app/lib/date';

const SPECIES_LABEL: Record<string, string> = {
  dog: 'Canine',
  cat: 'Feline',
  horse: 'Equine',
  other: 'Other',
};

const GENDER_LABEL: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  unknown: 'Unknown',
};

const DASH = '-';

const clean = (value?: string | number | null): string => {
  const text = String(value ?? '').trim();
  return text || DASH;
};

const formatAgeDob = (dateOfBirth?: Date | string): string => {
  if (!dateOfBirth) return DASH;
  const age = getAgeInYears(dateOfBirth);
  const dob = formatDisplayDate(dateOfBirth, DASH);
  if (!Number.isFinite(age) || age < 0) return dob;
  const ageLabel = `${age} ${age === 1 ? 'year' : 'years'}`;
  return dob === DASH ? ageLabel : `${ageLabel} / ${dob}`;
};

/** "Female, Spayed" / "Male, Neutered" / "Female" when neuter status is unknown. */
const formatSex = (gender?: string, isNeutered?: boolean): string => {
  const genderLabel = GENDER_LABEL[gender?.toLowerCase() ?? ''] ?? DASH;
  if (genderLabel === DASH) return DASH;
  if (isNeutered == null) return genderLabel;
  const neuterTerm = gender === 'female' ? 'Spayed' : 'Neutered';
  return isNeutered ? `${genderLabel}, ${neuterTerm}` : genderLabel;
};

const formatBreedSpecies = (breed?: string, type?: string): string => {
  const speciesLabel = type ? (SPECIES_LABEL[type.toLowerCase()] ?? type) : '';
  return (
    [breed, speciesLabel]
      .map((part) => String(part ?? '').trim())
      .filter(Boolean)
      .join(' / ') || DASH
  );
};

const WEIGHT_UNIT = 'kg';

const formatWeight = (weight?: number): string =>
  weight == null ? DASH : `${weight} ${WEIGHT_UNIT}`;

type CompanionFallback = {
  id: string;
  name: string;
  species?: string;
  breed?: string;
};

/**
 * Builds the companion context-card rows from the full companion record when it
 * has loaded, falling back to the lighter appointment companion summary so the
 * card always shows the name/ID/breed even before the companion store resolves.
 */
export const buildCompanionDetails = (
  fallback: CompanionFallback,
  companion?: StoredCompanion
): CompanionDetail[] => [
  { label: 'Name', value: clean(companion?.name ?? fallback.name) },
  { label: 'Patient ID', value: clean(companion?.id ?? fallback.id) },
  {
    label: 'Breed/Species',
    value: formatBreedSpecies(
      companion?.breed ?? fallback.breed,
      companion?.type ?? fallback.species
    ),
  },
  { label: 'Age / DOB', value: formatAgeDob(companion?.dateOfBirth) },
  { label: 'Sex', value: formatSex(companion?.gender, companion?.isneutered) },
  { label: 'Weight', value: formatWeight(companion?.currentWeight) },
  { label: 'Blood Group', value: clean(companion?.bloodGroup) },
  { label: 'Microchip ID', value: clean(companion?.microchipNumber) },
  { label: 'Allergies', value: clean(companion?.allergy) },
];
