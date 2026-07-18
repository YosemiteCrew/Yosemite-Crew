export interface OrganizationTypeCoding {
  system: string;
  code: string;
  display?: string;
}

export interface OrganizationMongo {
  fhirId?: string;
  name: string;
  taxId: string;
  DUNSNumber?: string;
  imageURL?: string;
  type: "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";
  petNamePreference?: "COMPANION" | "ANIMAL" | "PATIENT";
  phoneNo: string;
  website?: string;
  documensoTeamId?: string;
  documensoApiKey?: string;
  address?: {
    addressLine?: string;
    country?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    location?: {
      type: "Point";
      coordinates: [number, number];
    };
  };
  isVerified?: boolean;
  isActive?: boolean;
  typeCoding?: OrganizationTypeCoding;
  healthAndSafetyCertNo?: string;
  animalWelfareComplianceCertNo?: string;
  fireAndEmergencyCertNo?: string;
  googlePlacesId?: string;
  stripeAccountId?: string;
  averageRating?: number;
  ratingCount?: number;
  appointmentCheckInBufferMinutes?: number;
  appointmentCheckInRadiusMeters?: number;
  appointmentLockWindowOutpatientMinutes?: number;
  appointmentLockWindowInpatientMinutes?: number;
  crossOrgMessagingEnabled?: boolean;
}

export type OrganizationDocument = OrganizationMongo & { _id: string };
