import type {
  ClinicalExamDTO,
  ParasiteTreatmentDTO,
  ParasiteTreatmentType,
  PetPassportDTO,
  RabiesTitrationDTO,
  VaccinationDTO,
  VaccineType,
} from '@yosemite-crew/types';
import { formatDisplayDate, formatDateTimeLocal } from '@/app/lib/date';

/** The four record kinds a passport is assembled from, in capture order. */
export type PassportRecordKind = 'VACCINATION' | 'TITRATION' | 'TREATMENT' | 'EXAM';

/**
 * A captured record is a DRAFT clinical artifact: it belongs to this visit but
 * stays off the passport until a veterinarian attests it, at which point the
 * backend returns it inside the assembled passport as a SIGNED record.
 */
export type PassportRecordStatus = 'DRAFT' | 'SIGNED';

export type PassportRecordRow = {
  id: string;
  kind: PassportRecordKind;
  title: string;
  detail: string;
  status: PassportRecordStatus;
};

export const PASSPORT_RECORD_KIND_LABELS: Record<PassportRecordKind, string> = {
  VACCINATION: 'Vaccination',
  TITRATION: 'Rabies titration',
  TREATMENT: 'Parasite treatment',
  EXAM: 'Clinical exam',
};

export const VACCINE_TYPE_LABELS: Record<VaccineType, string> = {
  RABIES: 'Rabies',
  CORE: 'Core',
  NON_CORE: 'Non-core',
  OTHER: 'Other',
};

export const PARASITE_TREATMENT_TYPE_LABELS: Record<ParasiteTreatmentType, string> = {
  ECHINOCOCCUS: 'Echinococcus',
  TICK: 'Tick',
  FLEA: 'Flea',
  OTHER: 'Other',
};

const NO_DATE = 'date not recorded';

export const toVaccinationRow = (
  record: VaccinationDTO,
  status: PassportRecordStatus
): PassportRecordRow => ({
  id: record.id,
  kind: 'VACCINATION',
  title: record.vaccineName,
  detail: `${VACCINE_TYPE_LABELS[record.vaccineType]} · given ${formatDisplayDate(
    record.dateAdministered,
    NO_DATE
  )}`,
  status,
});

export const toParasiteTreatmentRow = (
  record: ParasiteTreatmentDTO,
  status: PassportRecordStatus
): PassportRecordRow => ({
  id: record.id,
  kind: 'TREATMENT',
  title: record.productName,
  detail: `${PARASITE_TREATMENT_TYPE_LABELS[record.treatmentType]} · treated ${formatDateTimeLocal(
    record.treatedAt,
    NO_DATE
  )}`,
  status,
});

export const toRabiesTitrationRow = (
  record: RabiesTitrationDTO,
  status: PassportRecordStatus
): PassportRecordRow => ({
  id: record.id,
  kind: 'TITRATION',
  title: `${record.resultIuMl} IU/ml`,
  detail: `${record.approvedLab} · sampled ${formatDisplayDate(record.sampleDate, NO_DATE)}`,
  status,
});

export const toClinicalExamRow = (
  record: ClinicalExamDTO,
  status: PassportRecordStatus
): PassportRecordRow => ({
  id: record.id,
  kind: 'EXAM',
  title: record.fitForTravel ? 'Fit for travel' : 'Not fit for travel',
  detail: `Examined ${formatDateTimeLocal(record.examinedAt, NO_DATE)}`,
  status,
});

/**
 * Every record the assembled passport carries. The passport surfaces the rabies
 * dose separately because it drives validity, so it is folded back in (by id) to
 * avoid listing the same dose twice.
 */
export const buildSignedRecordRows = (passport?: PetPassportDTO | null): PassportRecordRow[] => {
  if (!passport) return [];
  const vaccinations = [...passport.vaccinations];
  const rabies = passport.rabies;
  if (rabies && !vaccinations.some((entry) => entry.id === rabies.id)) {
    vaccinations.unshift(rabies);
  }
  return [
    ...vaccinations.map((entry) => toVaccinationRow(entry, 'SIGNED')),
    ...passport.rabiesTitrations.map((entry) => toRabiesTitrationRow(entry, 'SIGNED')),
    ...passport.parasiteTreatments.map((entry) => toParasiteTreatmentRow(entry, 'SIGNED')),
    ...passport.clinicalExams.map((entry) => toClinicalExamRow(entry, 'SIGNED')),
  ];
};
