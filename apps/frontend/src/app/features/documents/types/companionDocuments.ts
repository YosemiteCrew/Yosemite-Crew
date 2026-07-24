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

/**
 * Where a record sits in the design's medical-record lifecycle, matching the
 * "Requested / Uploaded / Generated / Signed" filter tabs on the Records &
 * Reference frame.
 */
export type RecordLifecycle = 'requested' | 'uploaded' | 'generated' | 'signed';

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
  /**
   * Explicit lifecycle state, when the API knows it. Optional because
   * GET /v1/document/pms/:companionId does not return it today, so
   * `deriveRecordLifecycle` falls back to the signals below.
   *
   * BACKEND: add `lifecycle` to `DocumentDto` in
   * apps/backend/src/services/document.service.ts. It is the only honest source
   * for the "Requested" arm — a record that has been asked for but has no file
   * yet — which no field currently expresses.
   */
  lifecycle?: RecordLifecycle;
  /**
   * When the record was signed. Optional because no signing signal exists for
   * documents today: form submissions carry `signing.status`, plain documents
   * do not.
   *
   * BACKEND: add `signedAt` to `DocumentDto`. The DTO's existing `signingStatus`
   * cannot be used — `mapDocumentToDto` derives it as
   * `pmsVisible ? 'SIGNED' : 'NOT_STARTED'` and `listForPms` only returns
   * `pmsVisible: true` rows, so it is the constant 'SIGNED'.
   */
  signedAt?: string | null;
  /**
   * What produced the record: 'DOCUMENT' for an uploaded file, or a rendered
   * document's kind (e.g. 'TEMPLATE_INSTANCE', 'CLINICAL_ARTIFACT') for one the
   * system generated. Already part of the backend's `DocumentDto`; optional
   * here because `listForPms` returns only plain documents, so it is always
   * 'DOCUMENT' today.
   *
   * BACKEND: merge rendered documents into `DocumentService.listForPms`, the
   * way `listForAppointmentParent` already does.
   */
  sourceKind?: string;
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
