import { PersonalDetails } from './personalDetails';
import { ProfessionalDetails } from './professionalDetails';

export type UserProfile = {
  _id?: string;
  userId: string; // reference to users collection
  organizationId: string; // reference to organizations collection
  personalDetails?: PersonalDetails;
  professionalDetails?: ProfessionalDetails;
  status?: 'DRAFT' | 'COMPLETED';
  createdAt?: Date;
  updatedAt?: Date;
}