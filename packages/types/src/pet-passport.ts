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
