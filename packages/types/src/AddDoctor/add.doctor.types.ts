export type AvailabilityTime = {
  from: {
    hour: string;
    minute: string;
    period: 'AM' | 'PM';
  };
  to: {
    hour: string;
    minute: string;
    period: 'AM' | 'PM';
  };
};

export type Availability = {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  times: AvailabilityTime[];
};

export type DocumentFile = {
  name: string;
  type: string;
  date?: Date;
};

export type AddDoctorDoc = {
  userId: string;
  bussinessId: string;

  registrationNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  gender: string;
  dateOfBirth: string;
  linkedin: string;
  medicalLicenseNumber: string;
  yearsOfExperience: number;
  postalCode: string; // renamed from postalCode
  addressLine1: string;
  city: string;
  stateProvince: string;
  biography: string;

  area: string;
  countrycode: string;

  specialization: string;

  image: string;

  availability: Availability[];

  documents: DocumentFile[];
duration: string; // newly added field
  createdAt?: Date;
  updatedAt?: Date;
};



