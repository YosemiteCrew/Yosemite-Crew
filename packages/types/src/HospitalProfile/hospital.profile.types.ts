export interface name {
  userId: string;
  businessName: string;
  website: string;
  registrationNumber: string;
  city: string;
  state: string;
  addressLine1: string;
  latitude: string;
  longitude: string;
  postalCode: string;
  PhoneNumber: string;
  country?:string
}
export interface BusinessProfile {
 userId?: string;
  businessName?: string;
  website?: string;
  registrationNumber?: string;
  city?: string;
  state?: string;
  addressLine1?: string;
  latitude?: string;
  longitude?: string;
  postalCode?: string;
  PhoneNumber?: string;
  name?: name;
  country: string;
  departmentFeatureActive: string; // yes/no
  selectedServices: string[];
  addDepartment: string[];
  image?: File | null;
  previewUrl?: string;
};

export interface FhirOrganization {
  resourceType: "Organization";
  id?: string;
  name: string;
  extension?: any[];
  address?: {
    line: string[];
    city: string;
    state: string;
    postalCode: string;
    country: string;
    extension?: any[];
  }[];
  telecom?: { system: string; value: string }[];
  contact?: unknown[];
};