import { getData, postData } from '@/app/services/axios';

export type MedicationAdministrationStatus = 'SCHEDULED' | 'GIVEN' | 'HELD' | 'MISSED' | 'REFUSED';

/** The outcomes a nurse can record against a dose that is still scheduled. */
export type MedicationAdministrationOutcome = Exclude<MedicationAdministrationStatus, 'SCHEDULED'>;

export type MedicationAdministrationEntry = {
  id: string;
  organisationId: string;
  patientId: string;
  encounterId: string | null;
  prescriptionId: string | null;
  medicationName: string;
  dose: string;
  route: string;
  scheduledAt: string;
  administeredAt: string | null;
  administeredBy: string | null;
  status: MedicationAdministrationStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateMedicationAdministrationInput = {
  organisationId: string;
  patientId: string;
  encounterId: string;
  prescriptionId?: string;
  medicationName: string;
  dose: string;
  route: string;
  scheduledAt: string;
};

const marEndpoint = (organisationId: string) =>
  `/v1/pms/organisation/${organisationId}/mar-entries`;

const OUTCOME_ENDPOINTS: Record<MedicationAdministrationOutcome, string> = {
  GIVEN: 'administer',
  HELD: 'hold',
  MISSED: 'miss',
  REFUSED: 'refuse',
};

export const listMedicationAdministrations = async (
  organisationId: string,
  patientId: string,
  encounterId: string
) => {
  const response = await getData<MedicationAdministrationEntry[]>(marEndpoint(organisationId), {
    patientId,
    encounterId,
  });
  return response.data;
};

export const createMedicationAdministration = async (
  input: CreateMedicationAdministrationInput
) => {
  const { organisationId, ...body } = input;
  const response = await postData<MedicationAdministrationEntry, typeof body>(
    marEndpoint(organisationId),
    body
  );
  return response.data;
};

export const recordMedicationOutcome = async (
  organisationId: string,
  entryId: string,
  outcome: MedicationAdministrationOutcome
) => {
  const response = await postData<MedicationAdministrationEntry>(
    `${marEndpoint(organisationId)}/${entryId}/${OUTCOME_ENDPOINTS[outcome]}`,
    {}
  );
  return response.data;
};
