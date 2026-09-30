import { getData, postData } from '@/app/services/axios';

export type PossibleDuplicatePatient = {
  id: string;
  name: string;
  dateOfBirth: string;
};

export type PossibleDuplicate = {
  patientA: PossibleDuplicatePatient;
  patientB: PossibleDuplicatePatient;
  matchingOn: 'microchip' | 'name-and-birth-date';
};

export const loadPossibleDuplicates = async (organisationId: string) => {
  const response = await getData<{ matches: PossibleDuplicate[] }>(
    `/fhir/v1/companion/org/${encodeURIComponent(organisationId)}/possible-duplicates`
  );
  return response.data.matches;
};

export const dismissPossibleDuplicate = async (
  organisationId: string,
  patientAId: string,
  patientBId: string
) => {
  await postData(
    `/fhir/v1/companion/org/${encodeURIComponent(organisationId)}/possible-duplicates/${encodeURIComponent(patientAId)}/${encodeURIComponent(patientBId)}/dismiss`
  );
};
