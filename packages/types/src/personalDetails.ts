import { Address } from "./address.model";

export type PersonalDetails = {
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: Date;
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
  address?: Address
  phoneNumber?: string;
  profilePictureUrl?: string;
};
