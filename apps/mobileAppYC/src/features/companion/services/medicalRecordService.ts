import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';

export type MobileAllergy = {
  id: string;
  allergen: string;
  allergyType: string;
  severity: string;
  reaction?: string;
  status: 'ACTIVE' | 'UNCONFIRMED';
  onsetDate?: string;
  recordedAt: string;
};

export type MobileProblem = {
  id: string;
  name: string;
  codeSystem?: string;
  code?: string;
  status: 'ACTIVE' | 'INACTIVE';
  severity?: string;
  onsetDate?: string;
  recordedAt: string;
};

const companionPath = (patientId: string): string =>
  `/v1/patient-allergies/mobile/companion/${encodeURIComponent(patientId)}`;

const problemPath = (patientId: string): string =>
  `/v1/patient-problems/mobile/companion/${encodeURIComponent(patientId)}`;

export const medicalRecordApi = {
  async fetchAllergies(
    patientId: string,
    accessToken: string,
  ): Promise<MobileAllergy[]> {
    const response = await apiClient.get<{allergies: MobileAllergy[]}>(
      companionPath(patientId),
      {headers: withAuthHeaders(accessToken)},
    );
    return response.data.allergies ?? [];
  },

  async fetchProblems(
    patientId: string,
    accessToken: string,
  ): Promise<MobileProblem[]> {
    const response = await apiClient.get<{problems: MobileProblem[]}>(
      problemPath(patientId),
      {headers: withAuthHeaders(accessToken)},
    );
    return response.data.problems ?? [];
  },
};
