// src/types/adverse-event.ts
export type AdverseEventReporterType = "PARENT" | "CO_PARENT" | "CLINIC_STAFF";

export type AdverseEventStatus =
  | "DRAFT"
  | "SUBMITTED"            // submitted by parent
  | "REVIEWING"            // clinic/manufacturer is looking at it
  | "FORWARDED"            // forwarded to manufacturer/reg authority
  | "CLOSED";

export type AdverseEventDestinations = {
  sendToManufacturer: boolean;
  sendToHospital: boolean;
  sendToAuthority: boolean;
};

export interface AdverseEventReporterInfo {
  userId?: string;               // parentId / co-parent id if known
  type: AdverseEventReporterType;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  email: string;
  dateOfBirth?: string;          // ISO string
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  currency?: string;             // USD/EUR etc – from screen
}

export interface AdverseEventCompanionInfo {
  companionId?: string;          // if linked to existing pet
  name: string;
  breed?: string;
  dateOfBirth?: string;
  gender?: string;
  currentWeight?: string;
  color?: string;
  neuteredStatus?: string;
  bloodGroup?: string;
  microchipNumber?: string;
  passportNumber?: string;
  insured?: string;
  insuranceCompany?: string;
  insurancePolicyNumber?: string;
  countryOfOrigin?: string;
  originDetails?: string;
}

export interface AdverseEventProductInfo {
  productName: string;
  brandName?: string;
  manufacturingCountry?: string;
  batchNumber?: string;
  numberOfTimesUsed?: number;
  quantityUsed?: number;
  dosageForm?: string;           // Tablet, liquid, etc
  administrationRoute?: string;  // On skin, oral, injection...
  reasonToUse?: string;
  conditionBefore?: string;
  conditionAfter?: string;
  eventDate?: string;            // when the adverse event happened
  productImageUrl?: string;      // uploaded photo
}

export interface AdverseEventConsent {
  agreedToContact: boolean;          // “I agree to be contacted...”
  agreedToTermsAt?: Date;           // when they ticked T&C + privacy
}

export interface AdverseEventReport {
  id?: string;

  // Links
  organisationId?: string;          // selected clinic
  appointmentId?: string | null;

  reporter: AdverseEventReporterInfo;
  companion: AdverseEventCompanionInfo;
  product: AdverseEventProductInfo;

  destinations: AdverseEventDestinations;
  consent: AdverseEventConsent;

  status: AdverseEventStatus;

  createdAt: Date;
  updatedAt: Date;
}