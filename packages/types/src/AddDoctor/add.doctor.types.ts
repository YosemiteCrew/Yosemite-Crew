import { Document } from 'mongoose';
type TimeSlot = {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
};

type Availability = {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  times: {
    from: TimeSlot;
    to: TimeSlot;
  }[];
};

type DocumentFile = {
  name: string;
  type: string;
  date?: Date;
};

type CvFile = {
  name: string;
  type: string;
  date?: Date;
};

export type AddDoctorDoc = Document & {
  userId: string;
  bussinessId: string;
  personalInfo: {
    image?: string;
    firstName?: string;
    lastName?: string;
    gender?: string;
    dateOfBirth?: string;
    email?: string;
    countrycode?: string;
    phone?: string;
  };
  residentialAddress: {
    addressLine1?: string;
    city?: string;
    stateProvince?: string;
    country?: string;
    zipCode?: string;
  };
  professionalBackground: {
    specialization?: string;
    qualification?: string;
    medicalLicenseNumber?: string;
    yearsOfExperience?: number;
    languagesSpoken?: string;
    biography?: string;
    image?: string;
  };
  availability: Availability[];
  documents: DocumentFile[];
  cvFile?: CvFile;
  timeDuration?: number;
  activeModes?: ('In-person' | 'Online' | 'Both')[];
  isAvailable?: string;
  consultFee?: number;
  DoctorPrescriptions?: string;
  authSettings?: {
    takeAssessments?: boolean;
    appointments?: boolean;
    viewMedicalRecords?: boolean;
    prescribeMedications?: boolean;
  };
  termsAndConditions?: boolean;
};