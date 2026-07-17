import type {SelectItem} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';

export const SHARED_ENTRIES: Record<string, SelectItem[]> = {
  admin: [
    {id: 'passport', label: 'Passport'},
    {
      id: 'certificates',
      label: 'Certificates (incl. pedigree, microchip, awards, breeder papers)',
    },
    {id: 'insurance', label: 'Insurance'},
  ],
  'dietary-plans': [{id: 'nutrition-plans', label: 'Nutrition plans'}],
  others: [
    {
      id: 'weight-logs',
      label: 'Weight logs, behaviour notes, photos of wounds, etc.',
    },
  ],
};

export const EXPENSE_SUBCATEGORIES: Record<string, SelectItem[]> = {
  ...SHARED_ENTRIES,
  health: [
    {id: 'hospital-visits', label: 'Hospital visits'},
    {id: 'prescriptions-treatments', label: 'Prescriptions & treatments'},
    {
      id: 'vaccination-parasite',
      label: 'Vaccination, parasite prevention & chronic condition',
    },
    {id: 'lab-tests', label: 'Lab tests'},
  ],
  'hygiene-maintenance': [
    {id: 'grooming-visits', label: 'Grooming visits'},
    {id: 'boarding-records', label: 'Boarding records'},
    {id: 'training-behaviour', label: 'Training & behaviour reports'},
    {id: 'breeder-interactions', label: 'Breeder interactions'},
  ],
};
