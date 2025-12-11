import { EmploymentTypesProps } from "./team";

export type Status = "DRAFT" | "COMPLETED";

export type Gender = "MALE" | "FEMALE" | "OTHERS";

export const GenderOptions: Gender[] = ["MALE", "FEMALE", "OTHERS"];

export type DocumentType = "LICENSE" | "CERTIFICATE" | "OTHERS";

export type Address = {
  addressLine?: string;
  country?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
};

export type Document = {
  type?: DocumentType;
  fileUrl?: string;
  uploadedAt: string;
  verified?: boolean;
};

export type PersonalDetails = {
  gender?: Gender;
  dateOfBirth?: string;
  employmentType?: EmploymentTypesProps;
  address?: Address;
  phoneNumber?: string;
  profilePictureUrl?: string;
};

export type ProfessionalDetails = {
  medicalLicenseNumber?: string;
  yearsOfExperience?: number;
  specialization?: string;
  qualification?: string;
  biography?: string;
  linkedin?: string;
  documents?: Document[];
};

export type UserProfile = {
  _id: string;
  userId?: string;
  organizationId: string;
  personalDetails?: PersonalDetails;
  professionalDetails?: ProfessionalDetails;
  status?: Status;
  createdAt?: string;
  updatedAt?: string;
};

export type UserProfileResponse = {
  _id: string;
  userId?: string;
  organizationId: string;
  personalDetails?: PersonalDetails;
  professionalDetails?: ProfessionalDetails;
  status?: Status;
  createdAt?: string;
  updatedAt?: string;
  baseAvailability?: any[];
};
