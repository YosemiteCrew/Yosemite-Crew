import type { VaccineType } from '../pet-passport';

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
