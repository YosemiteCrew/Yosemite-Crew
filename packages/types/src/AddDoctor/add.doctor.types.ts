export type AvailabilityTime = {
  from: {
    hour: string;
    minute: string;
    period: "AM" | "PM";
  };
  to: {
    hour: string;
    minute: string;
    period: "AM" | "PM";
  };
};

export type Availability = {
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  times: AvailabilityTime[];
};

export type DocumentFile = {
  name: string;
  type: string;
  date?: Date;
};

export type AddDoctorDoc = {
  userId: string;
  status: string;

  rcvsNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  gender: string;
  dateOfBirth: string;
  linkedin: string;
  medicalLicenseNumber: string;
  yearsOfExperience: string;
  postalCode: string; // renamed from postalCode
  addressLine1: string;
  city: string;
  stateProvince: string;
  biography: string;

  area: string;
  countrycode: string;
  bussinessId?: string;
  specialization: string;
  qualification: string;
  image: string;

  availability: Availability[];

  documents: DocumentFile[];
  duration: string; // newly added field
  progress?: String;
  createdAt?: Date;
  updatedAt?: Date;
  key?: string;
  joiningDate?: string;
  yearsOfWorking?: string;
};
