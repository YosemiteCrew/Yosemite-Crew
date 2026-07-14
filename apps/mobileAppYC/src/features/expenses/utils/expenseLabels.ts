import {DOCUMENT_CATEGORIES, VISIT_TYPES} from '@/features/documents/constants';

const CATEGORY_LABEL_MAP = DOCUMENT_CATEGORIES.reduce<Record<string, string>>(
  (accumulator, category) => {
    accumulator[category.id] = category.label;
    return accumulator;
  },
  {},
);

const SUBCATEGORY_LABEL_MAP: Record<string, Record<string, string>> = {
  admin: {
    passport: 'Passport',
    certificates:
      'Certificates (incl. pedigree, microchip, awards, breeder papers)',
    insurance: 'Insurance',
  },
  health: {
    'hospital-visits': 'Hospital visits',
    'prescriptions-treatments': 'Prescriptions & treatments',
    'prescriptions-&-treatments': 'Prescriptions & treatments',
    'vaccination-parasite':
      'Vaccination, parasite prevention & chronic condition',
    'vaccination,-parasite-prevention-&-chronic-condition':
      'Vaccination, parasite prevention & chronic condition',
    'lab-tests': 'Lab tests',
  },
  'hygiene-maintenance': {
    'grooming-visits': 'Grooming visits',
    'boarding-records': 'Boarding records',
    'training-behaviour': 'Training & behaviour reports',
    'training-&-behaviour-reports': 'Training & behaviour reports',
    'breeder-interactions': 'Breeder interactions',
  },
  'dietary-plans': {
    'nutrition-plans': 'Nutrition plans',
  },
  others: {
    'weight-logs': 'Weight logs, behaviour notes, photos of wounds, etc.',
  },
};

const VISIT_TYPE_MAP = VISIT_TYPES.reduce<Record<string, string>>(
  (accumulator, visitType) => {
    accumulator[visitType.label] = visitType.label;
    accumulator[visitType.id] = visitType.label;
    return accumulator;
  },
  {},
);

export const resolveCategoryLabel = (categoryId: string): string =>
  CATEGORY_LABEL_MAP[categoryId] ?? categoryId;

export const resolveSubcategoryLabel = (
  categoryId: string,
  subcategoryId: string,
): string => {
  return SUBCATEGORY_LABEL_MAP[categoryId]?.[subcategoryId] ?? subcategoryId;
};

export const resolveVisitTypeLabel = (visitTypeId: string): string =>
  VISIT_TYPE_MAP[visitTypeId] ?? visitTypeId;
