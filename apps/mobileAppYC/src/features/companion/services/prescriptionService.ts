import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';

export type MobilePrescriptionItem = {
  id: string;
  medication: string;
  strength?: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  quantity?: string;
  instructions?: string;
  refill?: string;
};

export type MobilePrescription = {
  id: string;
  patientId: string;
  encounterId: string;
  organisationId: string;
  status: string;
  summary?: string;
  signedAt?: string;
  createdAt: string;
  items: MobilePrescriptionItem[];
};

type PrescriptionPage = {
  prescriptions: MobilePrescription[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

const ENDPOINT = '/v1/prescription/mobile';

export const prescriptionApi = {
  async list(accessToken: string): Promise<MobilePrescription[]> {
    const response = await apiClient.get<PrescriptionPage>(ENDPOINT, {
      params: {limit: 100},
      headers: withAuthHeaders(accessToken),
    });
    return response.data.prescriptions ?? [];
  },

  async requestRefill(
    prescriptionId: string,
    accessToken: string,
  ): Promise<void> {
    await apiClient.post(
      `${ENDPOINT}/${encodeURIComponent(prescriptionId)}/refill`,
      undefined,
      {headers: withAuthHeaders(accessToken)},
    );
  },
};
