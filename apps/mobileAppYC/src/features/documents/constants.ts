import {Images} from '@/assets/images';
import type {DocumentCategory} from '@/features/documents/types';
import {SUBCATEGORY_IDS as S} from '@/features/documents/subcategoryIds';

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    id: 'admin',
    label: 'Admin',
    icon: Images.adminIcon,
    isSynced: false,
    fileCount: 0,
    subcategories: [
      {id: S.PASSPORT, label: 'Passport', fileCount: 0},
      {
        id: S.CERTIFICATES,
        label:
          'Certificates (incl. pedigree, microchip, awards, breeder papers)',
        fileCount: 0,
      },
      {id: S.INSURANCE, label: 'Insurance', fileCount: 0},
    ],
  },
  {
    id: 'health',
    label: 'Health',
    icon: Images.healthIconCategory,
    isSynced: true,
    fileCount: 0,
    subcategories: [
      {id: S.SURGERY_PROCEDURE, label: 'Surgery/ Procedure', fileCount: 0},
      {id: S.PRESCRIPTION, label: 'Prescription', fileCount: 0},
      {id: S.VACCINATION, label: 'Vaccination', fileCount: 0},
      {id: S.DISCHARGE_SUMMARY, label: 'Discharge summary', fileCount: 0},
      {id: S.LAB_TEST, label: 'Lab test', fileCount: 0},
      {id: S.IMAGING_DIAGNOSTIC, label: 'Imaging/ Diagnostic', fileCount: 0},
      {id: S.PARASITE_PREVENTION, label: 'Parasite prevention', fileCount: 0},
      {id: S.MEDICAL_CONDITION, label: 'Medical condition', fileCount: 0},
      {id: S.OTHER, label: 'Other', fileCount: 0},
    ],
  },
  {
    id: 'hygiene-maintenance',
    label: 'Hygiene maintenance',
    icon: Images.hygieneIcon,
    isSynced: true,
    fileCount: 0,
    subcategories: [
      {id: S.BATHING, label: 'Bathing', fileCount: 0},
      {id: S.NAIL_TRIM, label: 'Nail trim', fileCount: 0},
      {id: S.GROOMING, label: 'Grooming', fileCount: 0},
      {id: S.EAR_CLEANING, label: 'Ear cleaning', fileCount: 0},
      {id: S.DENTAL_CLEANING, label: 'Dental cleaning', fileCount: 0},
      {id: S.SKIN_CARE, label: 'Skin care', fileCount: 0},
      {
        id: S.ANAL_GLAND_EXPRESSION,
        label: 'Anal gland expression',
        fileCount: 0,
      },
      {id: S.OTHER, label: 'Other', fileCount: 0},
    ],
  },
  {
    id: 'dietary-plans',
    label: 'Dietary plans',
    icon: Images.dietaryIcon,
    isSynced: false,
    fileCount: 0,
    subcategories: [
      {id: S.NUTRITION_PLANS, label: 'Nutrition plans', fileCount: 0},
    ],
  },
  {
    id: 'others',
    label: 'Others',
    icon: Images.othersIconCategory,
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
  [S.PASSPORT]: Images.passportIcon,
  [S.CERTIFICATES]: Images.certificateIcon,
  [S.INSURANCE]: Images.insuranceIcon,
  [S.SURGERY_PROCEDURE]: Images.hospitalIcon,
  [S.PRESCRIPTION]: Images.prescriptionIcon,
  [S.VACCINATION]: Images.vaccinationIcon,
  [S.DISCHARGE_SUMMARY]: Images.documentIcon,
  [S.LAB_TEST]: Images.labTestIcon,
  [S.IMAGING_DIAGNOSTIC]: Images.labTestIcon,
  [S.PARASITE_PREVENTION]: Images.vaccinationIcon,
  [S.MEDICAL_CONDITION]: Images.prescriptionIcon,
  [S.OTHER]: Images.othersIcon,
  [S.BATHING]: Images.groomingIcon,
  [S.NAIL_TRIM]: Images.groomingIcon,
  [S.GROOMING]: Images.groomingIcon,
  [S.EAR_CLEANING]: Images.groomingIcon,
  [S.DENTAL_CLEANING]: Images.groomingIcon,
  [S.SKIN_CARE]: Images.groomingIcon,
  [S.ANAL_GLAND_EXPRESSION]: Images.groomingIcon,
  [S.NUTRITION_PLANS]: Images.nutritionIcon,
  [S.WEIGHT_LOGS]: Images.othersIcon,
};

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
];
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];
export const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_DOCUMENT_MIME_TYPES,
];
export const ALLOWED_FILE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.heif',
  '.webp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
];
