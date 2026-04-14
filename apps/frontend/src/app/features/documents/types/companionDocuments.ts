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
    label: 'Hospital visits',
    value: 'HOSPITAL_VISITS',
  },
  {
    label: 'Prescriptions & treatments',
    value: 'PRESCRIPTIONS_AND_TREATMENTS',
  },
  {
    label: 'Vaccination & parasite prevention',
    value: 'VACCINATION_AND_PARASITE_PREVENTION',
  },
  {
    label: 'Lab tests',
    value: 'LAB_TESTS',
  },
];

export const HygieneCategoryOptions: Option[] = [
  {
    label: 'Grooming visits',
    value: 'GROOMER_VISIT',
  },
  {
    label: 'Boarding records',
    value: 'BOARDER_VISIT',
  },
  {
    label: 'Training & behavior reports',
    value: 'TRAINING_AND_BEHAVIOUR_REPORTS',
  },
  {
    label: 'Breeder interactions',
    value: 'BREEDER_VISIT',
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
  | 'HOSPITAL_VISITS'
  | 'PRESCRIPTIONS_AND_TREATMENTS'
  | 'VACCINATION_AND_PARASITE_PREVENTION'
  | 'LAB_TESTS';

export type HygieneSubcategory =
  | 'GROOMER_VISIT'
  | 'BOARDER_VISIT'
  | 'TRAINING_AND_BEHAVIOUR_REPORTS'
  | 'BREEDER_VISIT';

export type Subcategory = HealthSubcategory | HygieneSubcategory;

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
  subcategory: 'HOSPITAL_VISITS',
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
