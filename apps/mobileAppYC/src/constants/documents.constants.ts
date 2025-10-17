import {Images} from '@/assets/images';
import type {DocumentCategory} from '@/types/document.types';

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    id: 'admin',
    label: 'Admin',
    icon: Images.passportIcon,
    isSynced: false,
    fileCount: 0,
    subcategories: [
      {id: 'passport', label: 'Passport', fileCount: 0},
      {
        id: 'certificates',
        label: 'Certificates (incl. pedigree, microchip, awards, breeder papers)',
        fileCount: 0,
      },
      {id: 'insurance', label: 'Insurance', fileCount: 0},
    ],
  },
  {
    id: 'health',
    label: 'Health',
    icon: Images.hospitalIcon,
    isSynced: true,
    fileCount: 0,
    subcategories: [
      {id: 'hospital-visits', label: 'Hospital visits', fileCount: 0},
      {
        id: 'prescriptions-treatments',
        label: 'Prescriptions & treatments',
        fileCount: 0,
      },
      {
        id: 'vaccination-parasite',
        label: 'Vaccination, parasite prevention & chronic condition',
        fileCount: 0,
      },
      {id: 'lab-tests', label: 'Lab tests', fileCount: 0},
    ],
  },
  {
    id: 'hygiene-maintenance',
    label: 'Hygiene maintenance',
    icon: Images.groomingIcon,
    isSynced: true,
    fileCount: 0,
    subcategories: [
      {id: 'grooming-visits', label: 'Grooming visits', fileCount: 0},
      {id: 'boarding-records', label: 'Boarding records', fileCount: 0},
      {
        id: 'training-behaviour',
        label: 'Training & behaviour reports',
        fileCount: 0,
      },
      {id: 'breeder-interactions', label: 'Breeder interactions', fileCount: 0},
    ],
  },
  {
    id: 'dietary-plans',
    label: 'Dietary plans',
    icon: Images.nutritionIcon,
    isSynced: false,
    fileCount: 0,
    subcategories: [{id: 'nutrition-plans', label: 'Nutrition plans', fileCount: 0}],
  },
  {
    id: 'others',
    label: 'Others',
    icon: Images.othersIcon,
    isSynced: false,
    fileCount: 0,
    subcategories: [
      {
        id: 'weight-logs',
        label: 'Weight logs, behaviour notes, photos of wounds, etc.',
        fileCount: 0,
      },
    ],
  },
];

export const VISIT_TYPES = [
  {id: 'hospital', label: 'Hospital'},
  {id: 'groomer', label: 'Groomer'},
  {id: 'boarder', label: 'Boarder'},
  {id: 'breeder', label: 'Breeder'},
  {id: 'shop', label: 'Shop'},
  {id: 'other', label: 'Other'},
];

export const SUBCATEGORY_ICONS: Record<string, any> = {
  passport: Images.passportIcon,
  certificates: Images.certificateIcon,
  insurance: Images.insuranceIcon,
  'hospital-visits': Images.hospitalIcon,
  'prescriptions-treatments': Images.prescriptionIcon,
  'vaccination-parasite': Images.vaccinationIcon,
  'lab-tests': Images.labTestIcon,
  'grooming-visits': Images.groomingIcon,
  'boarding-records': Images.boardingIcon,
  'training-behaviour': Images.trainingIcon,
  'breeder-interactions': Images.breederIcon,
  'nutrition-plans': Images.nutritionIcon,
  'weight-logs': Images.othersIcon,
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
export const ALLOWED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
