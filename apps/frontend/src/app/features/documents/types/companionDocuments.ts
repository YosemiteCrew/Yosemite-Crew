import { Option } from '@/app/features/companions/types/companion';
import { makeOptions } from '@/app/lib/options';

/**
 * The `value` of every option below goes on the wire unchanged --
 * companionDocumentService posts `document.subcategory` straight to the API --
 * so each one has to be a value the server's document taxonomy accepts.
 */
export const CategoryOptions: Option[] = makeOptions([
  ['Health', 'HEALTH'],
  ['Hygiene maintenance', 'HYGIENE_MAINTENANCE'],
]);

export const HealthCategoryOptions: Option[] = makeOptions([
  ['Surgery/ Procedure', 'SURGERY_OR_PROCEDURE'],
  ['Prescription', 'PRESCRIPTION'],
  ['Vaccination', 'VACCINATION'],
  ['Discharge summary', 'DISCHARGE_SUMMARY'],
  ['Lab test', 'LAB_TEST'],
  ['Imaging/ Diagnostic', 'IMAGING_OR_DIAGNOSTIC'],
  ['Parasite prevention', 'PARASITE_PREVENTION'],
  ['Medical condition', 'MEDICAL_CONDITION'],
  ['Other', 'OTHER'],
]);

export const HygieneCategoryOptions: Option[] = makeOptions([
  ['Bathing', 'BATHING'],
  ['Nail trim', 'NAIL_TRIM'],
  ['Grooming', 'GROOMING'],
  ['Ear cleaning', 'EAR_CLEANING'],
  ['Dental cleaning', 'DENTAL_CLEANING'],
  ['Skin care', 'SKIN_CARE'],
  ['Anal gland expression', 'ANAL_GLAND_EXPRESSION'],
  ['Other', 'OTHER'],
]);

export const VisitTypeOptions: Option[] = makeOptions([
  ['Hospital', 'HOSPITAL'],
  ['Groomer', 'GROOMER'],
  ['Boarder', 'BOARDER'],
  ['Breeder', 'BREEDER'],
  ['Shop', 'SHOP'],
  ['Other', 'OTHER'],
]);

export type Attachment = {
  key: string;
  mimeType?: string;
  size?: number;
};

export type VisitType = 'HOSPITAL' | 'GROOMER' | 'BOARDER' | 'BREEDER' | 'SHOP' | 'OTHER';

export type Category = 'HEALTH' | 'HYGIENE_MAINTENANCE';

export type HealthSubcategory =
  | 'SURGERY_OR_PROCEDURE'
  | 'PRESCRIPTION'
  | 'VACCINATION'
  | 'DISCHARGE_SUMMARY'
  | 'LAB_TEST'
  | 'IMAGING_OR_DIAGNOSTIC'
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
  subcategory: 'SURGERY_OR_PROCEDURE',
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
