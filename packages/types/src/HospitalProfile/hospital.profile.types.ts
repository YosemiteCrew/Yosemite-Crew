export interface name {
  userId: string;
  businessName: string;
  website: string;
  registrationNumber: string;
  city: string;
  state: string;
  area?: string; // Optional area field
  addressLine1: string;
  latitude: string;
  longitude: string;
  postalCode: string;
  phoneNumber: string;
  country?:string
}
export interface BusinessProfile {
 userId?: string;
  businessName?: string;
  website?: string;
  registrationNumber?: string;
  city?: string;
  state?: string;
  area?: string; // Optional area field
  addressLine1?: string;
  latitude?: string;
  longitude?: string;
  postalCode?: string;
  phoneNumber?: string;
  name?: name;
  country: string;
  departmentFeatureActive: string; // yes/no
  selectedServices: string[];
  addDepartment: string[];
  image?:string[]; // URL to the image
  previewUrl?: string;
  key?:string
  progress?: number
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
    area?: string; // Optional area field
    extension?: any[];
  }[];
  telecom?: { system: string; value: string }[];
  contact?: unknown[];
};