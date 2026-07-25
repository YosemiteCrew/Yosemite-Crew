import type { UserProfile as UserProfileType } from "@yosemite-crew/types";

export interface UserProfileAddressMongo {
  addressLine?: string;
  country?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface UserProfilePersonalDetailsMongo {
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: Date;
  employmentType?: "FULL_TIME" | "PART_TIME" | "CONTRACT";
  address?: UserProfileAddressMongo;
  phoneNumber?: string;
  profilePictureUrl?: string;
  timezone?: string;
  pmsPreferences?: UserProfilePmsPreferencesMongo;
}

export interface UserProfileDocumentMongo {
  type: "LICENSE" | "CERTIFICATE" | "CV" | "OTHER";
  fileUrl: string;
  uploadedAt: Date;
  verified?: boolean;
}

export interface UserProfileProfessionalDetailsMongo {
  medicalLicenseNumber?: string;
  yearsOfExperience?: number;
  specialization?: string;
  qualification?: string;
  biography?: string;
  linkedin?: string;
  documents?: UserProfileDocumentMongo[];
}

export interface UserProfilePmsPreferencesMongo {
  defaultOpenScreen?: "APPOINTMENTS" | "DASHBOARD";
  appointmentView?: "CALENDAR" | "STATUS_BOARD" | "TABLE";
  animalTerminology?: "ANIMAL" | "COMPANION" | "PET" | "PATIENT";
}

export type UserProfileMongo = Omit<
  UserProfileType,
  "_id" | "personalDetails" | "professionalDetails"
> & {
  personalDetails?: UserProfilePersonalDetailsMongo;
  professionalDetails?: UserProfileProfessionalDetailsMongo;
};
