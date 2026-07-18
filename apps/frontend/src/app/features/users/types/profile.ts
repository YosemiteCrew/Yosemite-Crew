import { EmploymentTypesProps } from '@/app/features/organization/types/team';

export type Status = 'DRAFT' | 'COMPLETED';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export const GenderOptions: Gender[] = ['MALE', 'FEMALE', 'OTHER'];

/**
 * The employment types the user-profile API accepts. This is deliberately not
 * `EmploymentTypesProps`: that list is the organisation-invite enum, whose third
 * member is `CONTRACTOR`, while a user profile stores `CONTRACT`.
 */
export type ProfileEmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';

/**
 * Select options for the user-profile card. The values must be the exact enum
 * members the profile API accepts — it rejects anything else with a 400, which
 * surfaces as "Failed to update user profile". The pet-facing `GenderOptions`
 * (`OTHERS`) and the invite-facing `EmploymentTypes` (`CONTRACTOR`) lists look
 * interchangeable but are not, so the profile card keeps its own.
 */
export const UserGenderOptions: { label: string; value: Gender }[] = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
];

export const UserEmploymentTypeOptions: { label: string; value: ProfileEmploymentType }[] = [
  { label: 'Full time', value: 'FULL_TIME' },
  { label: 'Part time', value: 'PART_TIME' },
  { label: 'Contract', value: 'CONTRACT' },
];

export type DocumentType = 'LICENSE' | 'CERTIFICATE' | 'OTHERS';

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
  timezone?: string;
  pmsPreferences?: PmsPreferences;
};

export type DefaultOpenScreenPreference = 'APPOINTMENTS' | 'DASHBOARD';
export type AppointmentViewPreference = 'CALENDAR' | 'STATUS_BOARD' | 'TABLE';
export type AnimalTerminologyPreference = 'ANIMAL' | 'COMPANION' | 'PET' | 'PATIENT';

export type PmsPreferences = {
  defaultOpenScreen?: DefaultOpenScreenPreference;
  appointmentView?: AppointmentViewPreference;
  animalTerminology?: AnimalTerminologyPreference;
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
