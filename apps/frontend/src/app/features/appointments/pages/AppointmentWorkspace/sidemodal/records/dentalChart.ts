import type { DentalToothFinding } from '@/app/features/appointments/services/workspaceClinicalService';

/**
 * Modified Triadan numbering: the first digit is the quadrant (1-4 permanent,
 * 5-8 deciduous, clockwise from the right maxilla as the clinician faces the
 * patient) and the last two digits are the tooth position counted from the
 * midline. Positions are fixed across species, so a tooth a species lacks keeps
 * its gap: the cat has no 105, and its first mandibular tooth after the canine
 * is 307.
 */
export type Dentition = 'PERMANENT' | 'DECIDUOUS';
export type DentalSpecies = 'dog' | 'cat';
export type DentalQuadrant = { id: string; label: string; teeth: string[] };

const range = (quadrant: number, positions: number[]) =>
  positions.map((position) => `${quadrant}${String(position).padStart(2, '0')}`);

const DOG_UPPER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const DOG_LOWER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const CAT_UPPER = [1, 2, 3, 4, 6, 7, 8, 9];
const CAT_LOWER = [1, 2, 3, 4, 7, 8, 9];
const DECIDUOUS_UPPER = [1, 2, 3, 4, 6, 7, 8];
const DOG_DECIDUOUS_LOWER = [1, 2, 3, 4, 6, 7, 8];
const CAT_DECIDUOUS_LOWER = [1, 2, 3, 4, 7, 8];

/** Positions per quadrant, in quadrant order (upper right, upper left, lower left, lower right). */
const POSITIONS: Record<DentalSpecies, Record<Dentition, number[][]>> = {
  dog: {
    PERMANENT: [DOG_UPPER, DOG_UPPER, DOG_LOWER, DOG_LOWER],
    DECIDUOUS: [DECIDUOUS_UPPER, DECIDUOUS_UPPER, DOG_DECIDUOUS_LOWER, DOG_DECIDUOUS_LOWER],
  },
  cat: {
    PERMANENT: [CAT_UPPER, CAT_UPPER, CAT_LOWER, CAT_LOWER],
    DECIDUOUS: [DECIDUOUS_UPPER, DECIDUOUS_UPPER, CAT_DECIDUOUS_LOWER, CAT_DECIDUOUS_LOWER],
  },
};

const QUADRANT_LABELS = [
  'Right maxillary',
  'Left maxillary',
  'Left mandibular',
  'Right mandibular',
];

/**
 * Matches the species word, not a substring: "Cattle" is not a cat. Accepts the
 * common name, the adjective and the genus.
 */
export const resolveDentalSpecies = (species?: string): DentalSpecies | undefined => {
  const normalized = species?.trim().toLowerCase() ?? '';
  if (/^(cats?|feline|felis)\b/.test(normalized)) return 'cat';
  if (/^(dogs?|canine|canis)\b/.test(normalized)) return 'dog';
  return undefined;
};

export const getDentalQuadrants = (
  species: string | undefined,
  dentition: Dentition
): DentalQuadrant[] => {
  const dentalSpecies = resolveDentalSpecies(species);
  if (!dentalSpecies) return [];
  const offset = dentition === 'DECIDUOUS' ? 4 : 0;
  return POSITIONS[dentalSpecies][dentition].map((positions, index) => ({
    id: String(index + 1 + offset),
    label: QUADRANT_LABELS[index],
    teeth: range(index + 1 + offset, positions),
  }));
};

/** Quadrant 1-8 followed by position 01-11, the same rule the server enforces. */
export const isTriadanTooth = (tooth: string) => /^[1-8](0[1-9]|1[01])$/.test(tooth);

const ORDINALS = ['first', 'second', 'third', 'fourth'];

/**
 * The anatomical name a screen reader announces with the number, for example
 * "right maxillary canine" for 104 or "left mandibular first molar" for 309.
 */
export const describeTooth = (tooth: string): string => {
  if (!isTriadanTooth(tooth)) return '';
  const quadrant = Number(tooth[0]);
  const position = Number(tooth.slice(1));
  const side = QUADRANT_LABELS[(quadrant - 1) % 4].toLowerCase();
  const deciduous = quadrant > 4 ? 'deciduous ' : '';
  let kind: string;
  if (position <= 3) kind = `${ORDINALS[position - 1]} incisor`;
  else if (position === 4) kind = 'canine';
  else if (position <= 8) kind = `${ORDINALS[position - 5]} premolar`;
  else kind = `${ORDINALS[position - 9]} molar`;
  return `${side} ${deciduous}${kind}`;
};

export const CONDITION_OPTIONS: Array<{
  value: NonNullable<DentalToothFinding['condition']>;
  label: string;
}> = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'FRACTURE', label: 'Fracture' },
  { value: 'MISSING', label: 'Missing' },
  { value: 'EXTRACTED', label: 'Extracted' },
  { value: 'SUPERNUMERARY', label: 'Supernumerary' },
  { value: 'PERSISTENT_DECIDUOUS', label: 'Persistent deciduous' },
  { value: 'GINGIVITIS', label: 'Gingivitis' },
  { value: 'PERIODONTITIS', label: 'Periodontitis' },
  { value: 'TOOTH_RESORPTION', label: 'Tooth resorption' },
  { value: 'NEOPLASIA', label: 'Neoplasia' },
  { value: 'OTHER', label: 'Other' },
];

export const conditionLabel = (condition?: DentalToothFinding['condition']) =>
  CONDITION_OPTIONS.find((option) => option.value === condition)?.label ?? 'Finding recorded';

export const hasFinding = (finding?: DentalToothFinding) =>
  Boolean(
    finding &&
    (finding.condition ||
      finding.mobilityGrade ||
      finding.calculus !== undefined ||
      finding.periodontalDepth !== undefined ||
      finding.notes?.trim())
  );
