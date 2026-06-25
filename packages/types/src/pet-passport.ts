import type { CompanionType } from './companion';

// String-union mirrors of the Prisma VaccineType / ParasiteTreatmentType enums
// (matching the codebase convention of string unions over TS enums). These back
// the structured veterinary records a Digital Pet Passport is assembled from.
export type VaccineType = 'RABIES' | 'CORE' | 'NON_CORE' | 'OTHER';
export type ParasiteTreatmentType = 'ECHINOCOCCUS' | 'TICK' | 'FLEA' | 'OTHER';

// A single administered vaccination dose. All DateTimes are ISO strings per the
// DTO convention. Rabies doses carry the validity window the passport surfaces.
export interface VaccinationDTO {
  id: string;
  patientId: string;
  vaccineType: VaccineType;
  vaccineName: string;
  manufacturer?: string;
  batchNumber?: string;
  lotNumber?: string;
  dateAdministered: string;
  validFrom?: string;
  validUntil?: string;
  nextDueDate?: string;
  administeringVetName?: string;
  vetLicenseNumber?: string;
  site?: string;
  route?: string;
  notes?: string;
  createdAt: string;
}

// An anti-parasite treatment - notably the echinococcus/tapeworm dose required
// (with its date AND time) for entry to protected destinations.
export interface ParasiteTreatmentDTO {
  id: string;
  patientId: string;
  treatmentType: ParasiteTreatmentType;
  productName: string;
  manufacturer?: string;
  treatedAt: string;
  administeringVetName?: string;
  notes?: string;
  createdAt: string;
}

// A rabies antibody titration result (required from certain non-listed
// countries; must be at least 0.5 IU/ml from an approved laboratory).
export interface RabiesTitrationDTO {
  id: string;
  patientId: string;
  approvedLab: string;
  sampleDate: string;
  resultIuMl: number;
  reportUrl?: string;
  createdAt: string;
}

// The passport-issuance record: which authorised vet/clinic issued the passport,
// when, and under which authority. Surfaced in the passport's "Issuing" section.
export interface PetPassportIssuanceDTO {
  passportNumber: string;
  issuingCountry?: string;
  issuingAuthority?: string;
  issuingVetName?: string;
  issuingVetLicense?: string;
  issueDate: string;
  status?: string;
}

export interface PetPassportIdentity {
  id: string;
  name: string;
  species: CompanionType;
  breed: string;
  sex: string;
  dateOfBirth?: string;
  colour?: string;
  photoUrl?: string;
}

export interface PetPassportMicrochip {
  number: string;
  implantedAt?: string;
  location?: string;
}

// The assembled, multi-section pet passport, built server-side from the
// source-of-truth Patient and Vaccination rows. Rabies is surfaced separately
// because it drives passport validity; other vaccinations are listed together.
export interface PetPassportDTO {
  identity: PetPassportIdentity;
  microchip?: PetPassportMicrochip;
  passportNumber?: string;
  rabies?: VaccinationDTO;
  vaccinations: VaccinationDTO[];
  parasiteTreatments: ParasiteTreatmentDTO[];
  rabiesTitrations: RabiesTitrationDTO[];
  issuance?: PetPassportIssuanceDTO;
}
