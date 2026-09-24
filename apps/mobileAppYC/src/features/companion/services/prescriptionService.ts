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
const PAGE_SIZE = 100;

export const prescriptionApi = {
  /**
   * Every prescription the owner may read, across all of their companions.
   * Follows `nextCursor` while `hasMore`: the caller filters to one companion,
   * so stopping at the first page could hide that animal's rows entirely and
   * render "no prescriptions" as a false statement. A page that claims more
   * rows without a new cursor is a broken contract and throws rather than
   * returning a list that looks complete.
   */
  async list(accessToken: string): Promise<MobilePrescription[]> {
    const prescriptions: MobilePrescription[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const {data} = await apiClient.get<PrescriptionPage>(ENDPOINT, {
        params: {limit: PAGE_SIZE, cursor},
        headers: withAuthHeaders(accessToken),
      });
      prescriptions.push(...(data.prescriptions ?? []));
      hasMore = data.hasMore;
      if (hasMore && (!data.nextCursor || data.nextCursor === cursor)) {
        throw new Error('Prescription pagination did not advance');
      }
      cursor = data.nextCursor ?? undefined;
    }
    return prescriptions;
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
