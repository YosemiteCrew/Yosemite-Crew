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

export const administerMedication = async (organisationId: string, entryId: string) => {
  const response = await postData<MedicationAdministrationEntry>(
    `${marEndpoint(organisationId)}/${entryId}/administer`,
    {}
  );
  return response.data;
};

export const holdMedication = async (organisationId: string, entryId: string) => {
  const response = await postData<MedicationAdministrationEntry>(
    `${marEndpoint(organisationId)}/${entryId}/hold`,
    {}
  );
  return response.data;
};

export const missMedication = async (organisationId: string, entryId: string) => {
  const response = await postData<MedicationAdministrationEntry>(
    `${marEndpoint(organisationId)}/${entryId}/miss`,
    {}
  );
  return response.data;
};

export const refuseMedication = async (organisationId: string, entryId: string) => {
  const response = await postData<MedicationAdministrationEntry>(
    `${marEndpoint(organisationId)}/${entryId}/refuse`,
    {}
  );
  return response.data;
};
