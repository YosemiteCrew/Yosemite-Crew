import { Address } from './address.model';

export type PersonalDetails = {
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: Date;
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
  address?: Address;
  phoneNumber?: string;
  profilePictureUrl?: string;
  timezone?: string;
  pmsPreferences?: PmsPreferences;
};

export type PmsDefaultOpenScreen = 'APPOINTMENTS' | 'DASHBOARD';
export type PmsAppointmentView = 'CALENDAR' | 'STATUS_BOARD' | 'TABLE';
export type PmsAnimalTerminology = 'ANIMAL' | 'COMPANION' | 'PET' | 'PATIENT';

export type PmsPreferences = {
  defaultOpenScreen?: PmsDefaultOpenScreen;
  appointmentView?: PmsAppointmentView;
  animalTerminology?: PmsAnimalTerminology;
};
