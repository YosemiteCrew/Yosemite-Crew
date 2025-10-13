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
