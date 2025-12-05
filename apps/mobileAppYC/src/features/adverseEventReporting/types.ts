import type {DocumentFile} from '@/features/documents/types';

export type ReporterType = 'parent' | 'guardian';

export type QuantityUnit = 'tablet' | 'liquid';

export type AdministrationMethod =
  | 'none'
  | 'by mouth'
  | 'on the skin'
  | 'subcutaneous injection'
  | 'intramuscular injection'
  | 'into the ear'
  | 'into the eye'
  | 'other';

export interface CountryOption {
  name: string;
  code: string;
  flag: string;
  dial_code: string;
  iso3?: string;
}

export interface SupportedAdverseEventCountry extends CountryOption {
  iso3: string;
  authorityName: string;
}

export interface AdverseEventProductInfo {
  productName: string;
  brandName: string;
  manufacturingCountry: CountryOption | null;
  batchNumber: string;
  frequencyUsed: string;
  quantityUsed: string;
  quantityUnit: QuantityUnit;
  administrationMethod: AdministrationMethod | null;
  reasonToUseProduct: string;
  petConditionBefore: string;
  petConditionAfter: string;
  eventDate: Date;
  files: DocumentFile[];
}

export interface AdverseEventDestinations {
  sendToManufacturer: boolean;
  sendToHospital: boolean;
  sendToAuthority: boolean;
}

export interface AdverseEventReportDraft {
  companionId: string | null;
  reporterType: ReporterType;
  agreeToTerms: boolean;
  linkedBusinessId: string | null;
  productInfo: AdverseEventProductInfo | null;
  consentToContact: boolean;
}
