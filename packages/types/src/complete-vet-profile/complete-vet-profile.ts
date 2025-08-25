export type VetNameType = {
  rcvsNumber: string;
  status?: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  gender: string;
  dateOfBirth: string;
  linkedin: string;
  medicalLicenseNumber: string;
  yearsOfExperience: string;
  postalCode: string;
  addressLine1: string;
  city: string;
  area?: string;
  stateProvince: string;
  biography: string;
};

export type OperatingHourType = {
  day: string;
  checked: boolean;
  times: {
    from: { hour: string; minute: string; period: "AM" | "PM" };
    to: { hour: string; minute: string; period: "AM" | "PM" };
  }[];
};

export type ConvertToFhirVetProfileParams = {
  name: VetNameType;
  image?:
    | {
        name: string;
        type?: string;
      }
    | string;
  uploadedFiles?: {
    name: string;
    type?: string;
  }[];
  area?: string;
  specialization: string;
  qualification: string;
  countryCode: string;
  OperatingHour: OperatingHourType[];
  duration: string; // ✅ newly added field
  key?: string;
  joiningDate?: string;
  yearsOfWorking?: string;
};

export type PersonalDetails = {
  firstName: string;
  lastName: string;
  rcvsNumber: string;
  gender: string;
  email: string;
  dateOfBirth: string;
  mobileNumber: string;
  postalCode: string;
  addressLine1: string;
  area: string;
  city: string;
  stateProvince: string;
};
// ---- Types ----
export type ProfessionalDetails = {
  linkedin: string;
  medicalLicenseNumber: string;
  yearsOfExperience: string; //  
  specialization: string;
  qualification: string;
  biography: string;
};
// Simplified FHIR Practitioner type
export interface FhirPractitionerPersonalDetails {
  resourceType: "Practitioner";
  identifier?: { system: string; value: string }[];
  name?: { family?: string; given?: string[] }[];
  telecom?: { system: "phone" | "email"; value: string }[];
  gender?: string;
  birthDate?: string;
  address?: {
    line?: string[];
    city?: string;
    district?: string;
    postalCode?: string;
    state?: string;
  }[];
}
export interface FhirPractitionerProfessional {
  resourceType: "Practitioner";
  identifier?: { system: string; value: string }[];
  qualification?: {
    code: { text: string };
  }[];
  extension?: { url: string; valueString?: string }[]; // ✅ only valueString
}

 
export interface RelatedDoctorData {
  label: string;   // Doctor name
  value: string;   // Unique ID
  image: string;   // Profile picture
  department?: string; // Department / specialty
}

// Minimal FHIR Practitioner type  
export interface RelatedFhirPractitioner {
  resourceType: "Practitioner";
  id: string;
  name: {
    use: "official";
    text: string;
  }[];
  photo?: {
    url: string;
  }[];
  qualification?: {
    code: {
      text: string;
    };
  }[]; // we’ll use this to store department
}

