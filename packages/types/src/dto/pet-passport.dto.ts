import type { ParasiteTreatmentType, VaccineType } from '../pet-passport';

// Request to record an administered vaccination. The service applies the EU pet
// passport validity rules for rabies doses (animal at least 12 weeks old, the
// dose not pre-dating the microchip implant, validity starting 21 days after a
// primary dose) before persisting. DateTimes are ISO strings.
export interface RecordVaccinationRequestDTO {
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
}

// Request to record an anti-parasite (e.g. tapeworm) treatment. treatedAt carries
// both date and time, as the echinococcus rule requires.
export interface RecordParasiteTreatmentRequestDTO {
  treatmentType: ParasiteTreatmentType;
  productName: string;
  manufacturer?: string;
  treatedAt: string;
  administeringVetName?: string;
  notes?: string;
}

// Request to record a rabies antibody titration result.
export interface RecordRabiesTitrationRequestDTO {
  approvedLab: string;
  sampleDate: string;
  resultIuMl: number;
  reportUrl?: string;
}

// Request to record a pre-travel clinical examination. fitForTravel is the vet's
// attestation that the animal showed no signs of disease and is fit to travel.
export interface RecordClinicalExamRequestDTO {
  examinedAt: string;
  examiningVetName?: string;
  vetLicenseNumber?: string;
  fitForTravel: boolean;
  weightKg?: number;
  temperatureC?: number;
  findings?: string;
}

// Request to issue (or re-issue) the passport for a companion.
export interface IssuePassportRequestDTO {
  passportNumber: string;
  issuingCountry?: string;
  issuingAuthority?: string;
  issuingVetName?: string;
  issuingVetLicense?: string;
}
