import { Option } from '@/app/features/companions/types/companion';

export const CategoryOptions: Option[] = [
  {
    label: 'Health',
    value: 'HEALTH',
  },
  {
    label: 'Hygiene maintenance',
    value: 'HYGIENE_MAINTENANCE',
  },
];

export const HealthCategoryOptions: Option[] = [
  {
    label: 'Surgery/ Procedure',
    value: 'SURGERY_PROCEDURE',
  },
  {
    label: 'Prescription',
    value: 'PRESCRIPTION',
  },
  {
    label: 'Vaccination',
    value: 'VACCINATION',
  },
  {
    label: 'Discharge summary',
    value: 'DISCHARGE_SUMMARY',
  },
  {
    label: 'Lab test',
    value: 'LAB_TEST',
  },
  {
    label: 'Imaging/ Diagnostic',
    value: 'IMAGING_DIAGNOSTIC',
  },
  {
    label: 'Parasite prevention',
    value: 'PARASITE_PREVENTION',
  },
  {
    label: 'Medical condition',
    value: 'MEDICAL_CONDITION',
  },
  {
    label: 'Other',
    value: 'OTHER',
  },
];

export const HygieneCategoryOptions: Option[] = [
  {
    label: 'Bathing',
    value: 'BATHING',
  },
  {
    label: 'Nail trim',
    value: 'NAIL_TRIM',
  },
  {
    label: 'Grooming',
    value: 'GROOMING',
  },
  {
    label: 'Ear cleaning',
    value: 'EAR_CLEANING',
  },
  {
    label: 'Dental cleaning',
    value: 'DENTAL_CLEANING',
  },
  {
    label: 'Skin care',
    value: 'SKIN_CARE',
  },
  {
    label: 'Anal gland expression',
    value: 'ANAL_GLAND_EXPRESSION',
  },
  {
    label: 'Other',
    value: 'OTHER',
  },
];

export const VisitTypeOptions: Option[] = [
  {
    label: 'Hospital',
    value: 'HOSPITAL',
  },
  {
    label: 'Groomer',
    value: 'GROOMER',
  },
  {
    label: 'Boarder',
    value: 'BOARDER',
  },
  {
    label: 'Breeder',
    value: 'BREEDER',
  },
  {
    label: 'Shop',
    value: 'SHOP',
  },
  {
    label: 'Other',
    value: 'OTHER',
  },
];

export type Attachment = {
  key: string;
  mimeType?: string;
  size?: number;
};

export type VisitType = 'HOSPITAL' | 'GROOMER' | 'BOARDER' | 'BREEDER' | 'SHOP' | 'OTHER';

export type Category = 'HEALTH' | 'HYGIENE_MAINTENANCE';

export type HealthSubcategory =
  | 'SURGERY_PROCEDURE'
  | 'PRESCRIPTION'
  | 'VACCINATION'
  | 'DISCHARGE_SUMMARY'
  | 'LAB_TEST'
  | 'IMAGING_DIAGNOSTIC'
  | 'PARASITE_PREVENTION'
  | 'MEDICAL_CONDITION'
  | 'OTHER';

export type HygieneSubcategory =
  | 'BATHING'
  | 'NAIL_TRIM'
  | 'GROOMING'
  | 'EAR_CLEANING'
  | 'DENTAL_CLEANING'
  | 'SKIN_CARE'
  | 'ANAL_GLAND_EXPRESSION'
  | 'OTHER';

export type Subcategory = HealthSubcategory | HygieneSubcategory;

export const getSubcategoryOptionsForCategory = (category: Category): Option[] =>
  category === 'HEALTH' ? HealthCategoryOptions : HygieneCategoryOptions;

export const getDefaultSubcategoryForCategory = (category: Category): Subcategory =>
  getSubcategoryOptionsForCategory(category)[0].value as Subcategory;

const AllSubcategoryOptions = [...HealthCategoryOptions, ...HygieneCategoryOptions];

export const getCompanionDocumentCategoryLabel = (category: string): string =>
  CategoryOptions.find((option) => option.value === category)?.label ?? category;

export const getCompanionDocumentSubcategoryLabel = (subcategory: string): string =>
  AllSubcategoryOptions.find((option) => option.value === subcategory)?.label ?? subcategory;

export type CompanionRecord = {
  id?: string;
  title: string;
  category: Category;
  subcategory: Subcategory;
  attachments: Attachment[];
  appointmentId?: string;
  companionId?: string;
  visitType?: VisitType | null;
  issuingBusinessName?: string;
  issueDate?: string;
  hasIssueDate?: boolean;
  pmsVisible?: boolean;
  syncedFromPms?: boolean;
  uploadedByParentId?: string | null;
  uploadedByPmsUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const emptyCompanionRecord: CompanionRecord = {
  title: '',
  category: 'HEALTH',
  subcategory: 'SURGERY_PROCEDURE',
  attachments: [],
  appointmentId: undefined,
  visitType: 'HOSPITAL',
  issuingBusinessName: undefined,
  issueDate: new Date().toISOString().split('T')[0],
  hasIssueDate: true,
};

export type SignedFile = {
  url: string;
  mimeType: string;
  key: string;
};
