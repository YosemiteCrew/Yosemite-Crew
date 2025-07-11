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
  stateProvince: string;
  biography: string;
};

export type OperatingHourType = {
  day: string;
  checked: boolean;
  times: {
    from: { hour: string; minute: string; period: string };
    to: { hour: string; minute: string; period: string };
  }[];
};

export type ConvertToFhirVetProfileParams = {
  name: VetNameType;
  image?: File | null;
  uploadedFiles?: File[];
  specialization: string;
  countryCode: string;
  OperatingHour: OperatingHourType[];
  duration: string; // ✅ newly added field
};
