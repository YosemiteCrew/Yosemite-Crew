// src/features/companion/types.ts

export type CompanionCategory = 'cat' | 'dog' | 'horse';

export type CompanionGender = 'male' | 'female';

export type NeuteredStatus = 'neutered' | 'not-neutered';

export type InsuredStatus = 'insured' | 'not-insured';

export type CompanionOrigin = 'shop' | 'breeder' | 'foster-shelter' | 'friends-family' | 'unknown';

export interface Breed {
  speciesId: number;
  speciesName: string;
  breedId: number;
  breedName: string;
}

export interface Companion {
  id: string;
  userId: string;
  category: CompanionCategory;
  name: string;
  breed: Breed | null;
  dateOfBirth: string | null;
  gender: CompanionGender;
  currentWeight: number | null;
  color: string | null;
  allergies: string | null;
  neuteredStatus: NeuteredStatus;
  ageWhenNeutered: string | null;
  bloodGroup: string | null;
  microchipNumber: string | null;
  passportNumber: string | null;
  insuredStatus: InsuredStatus;
  insuranceCompany: string | null;
  insurancePolicyNumber: string | null;
  countryOfOrigin: string | null;
  origin: CompanionOrigin;
  profileImage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanionState {
  companions: Companion[];
  selectedCompanionId: string | null;
  loading: boolean;
  error: string | null;
}

export interface AddCompanionPayload {
  category: CompanionCategory;
  name: string;
  breed: Breed | null;
  dateOfBirth: string | null;
  gender: CompanionGender;
  currentWeight: number | null;
  color: string | null;
  allergies: string | null;
  neuteredStatus: NeuteredStatus;
  ageWhenNeutered: string | null;
  bloodGroup: string | null;
  microchipNumber: string | null;
  passportNumber: string | null;
  insuredStatus: InsuredStatus;
  insuranceCompany: string | null;
  insurancePolicyNumber: string | null;
  countryOfOrigin: string | null;
  origin: CompanionOrigin;
  profileImage: string | null;
}
