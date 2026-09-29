import { getData, postData } from '@/app/services/axios';

export type HospitalizationObservation = {
  id: string;
  patientId: string;
  encounterId: string | null;
  observedAt: string;
  temperature: number | null;
  temperatureUnit: string | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  painScore: number | null;
  inputMl: number | null;
  outputMl: number | null;
  notes: string | null;
  createdAt: string;
};

export type RecordHospitalizationObservation = {
  organisationId: string;
  patientId: string;
  encounterId: string;
  observedAt: string;
  temperature?: number;
  temperatureUnit?: 'C';
  heartRate?: number;
  respiratoryRate?: number;
  painScore?: number;
  inputMl?: number;
  outputMl?: number;
  notes?: string;
};

const endpoint = (organisationId: string) =>
  `/v1/pms/organisation/${organisationId}/hospitalization-monitoring`;

export const listHospitalizationObservations = async (
  organisationId: string,
  patientId: string,
  encounterId: string
) => {
  const response = await getData<HospitalizationObservation[]>(endpoint(organisationId), {
    patientId,
    encounterId,
  });
  return response.data;
};

export const recordHospitalizationObservation = async (input: RecordHospitalizationObservation) => {
  const { organisationId, ...body } = input;
  const response = await postData<HospitalizationObservation, typeof body>(
    endpoint(organisationId),
    body
  );
  return response.data;
};
