import { getData, postData } from '@/app/services/axios';

export type MedicationAdministrationStatus = 'SCHEDULED' | 'GIVEN' | 'HELD' | 'MISSED' | 'REFUSED';

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

export const MEDICATION_OUTCOME_ACTIONS = ['administer', 'hold', 'miss', 'refuse'] as const;

export type MedicationOutcomeAction = (typeof MEDICATION_OUTCOME_ACTIONS)[number];

/**
 * Post one dose outcome and return the entry as the server stored it.
 *
 * Every outcome is the same request against the same entry, differing only in
 * the trailing action, so the four exported functions below are named wrappers
 * over this one call.
 */
const recordMedicationOutcome = async (
  organisationId: string,
  entryId: string,
  outcome: MedicationOutcomeAction
) => {
  const response = await postData<MedicationAdministrationEntry>(
    `${marEndpoint(organisationId)}/${entryId}/${outcome}`,
    {}
  );
  return response.data;
};

export const administerMedication = (organisationId: string, entryId: string) =>
  recordMedicationOutcome(organisationId, entryId, 'administer');

export const holdMedication = (organisationId: string, entryId: string) =>
  recordMedicationOutcome(organisationId, entryId, 'hold');

export const missMedication = (organisationId: string, entryId: string) =>
  recordMedicationOutcome(organisationId, entryId, 'miss');

export const refuseMedication = (organisationId: string, entryId: string) =>
  recordMedicationOutcome(organisationId, entryId, 'refuse');
