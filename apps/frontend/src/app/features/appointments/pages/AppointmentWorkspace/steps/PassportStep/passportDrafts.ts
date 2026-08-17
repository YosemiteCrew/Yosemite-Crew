import type {
  IssuePassportRequestDTO,
  ParasiteTreatmentType,
  RecordClinicalExamRequestDTO,
  RecordParasiteTreatmentRequestDTO,
  RecordRabiesTitrationRequestDTO,
  RecordVaccinationRequestDTO,
  VaccineType,
} from '@yosemite-crew/types';
import {
  clinicalDateError,
  isoInstantFromLocal,
  localDateTimeError,
  numberError,
  optionalNumber,
  optionalText,
  requiredTextError,
  type FieldErrors,
} from '@/app/features/appointments/pages/AppointmentWorkspace/steps/PassportStep/passportFieldValidation';

// Drafts are all-string so every control stays controlled and the raw value the
// clinician typed is what gets validated - the same string the backend parses.

export type VaccinationDraft = {
  vaccineType: VaccineType;
  vaccineName: string;
  dateAdministered: string;
  manufacturer: string;
  batchNumber: string;
  lotNumber: string;
  validFrom: string;
  validUntil: string;
  nextDueDate: string;
  administeringVetName: string;
  vetLicenseNumber: string;
  site: string;
  route: string;
  notes: string;
};

export const EMPTY_VACCINATION_DRAFT: VaccinationDraft = {
  vaccineType: 'RABIES',
  vaccineName: '',
  dateAdministered: '',
  manufacturer: '',
  batchNumber: '',
  lotNumber: '',
  validFrom: '',
  validUntil: '',
  nextDueDate: '',
  administeringVetName: '',
  vetLicenseNumber: '',
  site: '',
  route: '',
  notes: '',
};

export const validateVaccinationDraft = (draft: VaccinationDraft): FieldErrors => ({
  vaccineName: requiredTextError('Vaccine name', draft.vaccineName),
  dateAdministered: clinicalDateError('Date administered', draft.dateAdministered, {
    required: true,
  }),
  validFrom: clinicalDateError('Valid from', draft.validFrom),
  validUntil: clinicalDateError('Valid until', draft.validUntil),
  nextDueDate: clinicalDateError('Next due', draft.nextDueDate),
});

export const buildVaccinationPayload = (draft: VaccinationDraft): RecordVaccinationRequestDTO => ({
  vaccineType: draft.vaccineType,
  vaccineName: draft.vaccineName.trim(),
  dateAdministered: draft.dateAdministered.trim(),
  manufacturer: optionalText(draft.manufacturer),
  batchNumber: optionalText(draft.batchNumber),
  lotNumber: optionalText(draft.lotNumber),
  validFrom: optionalText(draft.validFrom),
  validUntil: optionalText(draft.validUntil),
  nextDueDate: optionalText(draft.nextDueDate),
  administeringVetName: optionalText(draft.administeringVetName),
  vetLicenseNumber: optionalText(draft.vetLicenseNumber),
  site: optionalText(draft.site),
  route: optionalText(draft.route),
  notes: optionalText(draft.notes),
});

export type ParasiteTreatmentDraft = {
  treatmentType: ParasiteTreatmentType;
  productName: string;
  treatedAt: string;
  manufacturer: string;
  administeringVetName: string;
  notes: string;
};

export const EMPTY_PARASITE_TREATMENT_DRAFT: ParasiteTreatmentDraft = {
  treatmentType: 'ECHINOCOCCUS',
  productName: '',
  treatedAt: '',
  manufacturer: '',
  administeringVetName: '',
  notes: '',
};

export const validateParasiteTreatmentDraft = (draft: ParasiteTreatmentDraft): FieldErrors => ({
  productName: requiredTextError('Product name', draft.productName),
  treatedAt: localDateTimeError('Treated at', draft.treatedAt),
});

export const buildParasiteTreatmentPayload = (
  draft: ParasiteTreatmentDraft
): RecordParasiteTreatmentRequestDTO => ({
  treatmentType: draft.treatmentType,
  productName: draft.productName.trim(),
  // The echinococcus rule is time-sensitive, so the instant travels with an offset.
  treatedAt: isoInstantFromLocal(draft.treatedAt) ?? draft.treatedAt.trim(),
  manufacturer: optionalText(draft.manufacturer),
  administeringVetName: optionalText(draft.administeringVetName),
  notes: optionalText(draft.notes),
});

export type RabiesTitrationDraft = {
  approvedLab: string;
  sampleDate: string;
  resultIuMl: string;
  reportUrl: string;
};

export const EMPTY_RABIES_TITRATION_DRAFT: RabiesTitrationDraft = {
  approvedLab: '',
  sampleDate: '',
  resultIuMl: '',
  reportUrl: '',
};

export const validateRabiesTitrationDraft = (draft: RabiesTitrationDraft): FieldErrors => ({
  approvedLab: requiredTextError('Approved laboratory', draft.approvedLab),
  sampleDate: clinicalDateError('Sample date', draft.sampleDate, { required: true }),
  // The service rejects a negative titre with a 400.
  resultIuMl: numberError('Result', draft.resultIuMl, { required: true, min: 0 }),
});

export const buildRabiesTitrationPayload = (
  draft: RabiesTitrationDraft
): RecordRabiesTitrationRequestDTO => ({
  approvedLab: draft.approvedLab.trim(),
  sampleDate: draft.sampleDate.trim(),
  resultIuMl: Number(draft.resultIuMl.trim()),
  reportUrl: optionalText(draft.reportUrl),
});

export type ClinicalExamDraft = {
  examinedAt: string;
  fitForTravel: 'YES' | 'NO';
  findings: string;
  weightKg: string;
  temperatureC: string;
};

export const EMPTY_CLINICAL_EXAM_DRAFT: ClinicalExamDraft = {
  examinedAt: '',
  fitForTravel: 'YES',
  findings: '',
  weightKg: '',
  temperatureC: '',
};

export const validateClinicalExamDraft = (draft: ClinicalExamDraft): FieldErrors => ({
  examinedAt: localDateTimeError('Examined at', draft.examinedAt),
  weightKg: numberError('Weight', draft.weightKg, { min: 0 }),
  temperatureC: numberError('Temperature', draft.temperatureC),
});

export const buildClinicalExamPayload = (
  draft: ClinicalExamDraft
): RecordClinicalExamRequestDTO => ({
  examinedAt: isoInstantFromLocal(draft.examinedAt) ?? draft.examinedAt.trim(),
  fitForTravel: draft.fitForTravel === 'YES',
  findings: optionalText(draft.findings),
  weightKg: optionalNumber(draft.weightKg),
  temperatureC: optionalNumber(draft.temperatureC),
});

export type PassportIssuanceDraft = {
  passportNumber: string;
  issuingCountry: string;
  issuingAuthority: string;
  issuingVetName: string;
  issuingVetLicense: string;
};

export const EMPTY_PASSPORT_ISSUANCE_DRAFT: PassportIssuanceDraft = {
  passportNumber: '',
  issuingCountry: '',
  issuingAuthority: '',
  issuingVetName: '',
  issuingVetLicense: '',
};

export const validatePassportIssuanceDraft = (draft: PassportIssuanceDraft): FieldErrors => ({
  passportNumber: requiredTextError('Passport number', draft.passportNumber),
});

export const buildPassportIssuancePayload = (
  draft: PassportIssuanceDraft
): IssuePassportRequestDTO => ({
  passportNumber: draft.passportNumber.trim(),
  issuingCountry: optionalText(draft.issuingCountry),
  issuingAuthority: optionalText(draft.issuingAuthority),
  issuingVetName: optionalText(draft.issuingVetName),
  issuingVetLicense: optionalText(draft.issuingVetLicense),
});
