export type VetNameType = {
  registrationNumber: string;
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
  area?:string;
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
  image?: File | null;
  uploadedFiles?: File[];
  area?:string;
  specialization: string;
  countryCode: string;
  OperatingHour: OperatingHourType[];
  duration: string; // ✅ newly added field
};
