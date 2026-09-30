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

// Each page's cursor comes from the page before it, so pages are fetched one
// after another rather than in parallel. Pages are appended to the one array
// `list` passes in, so earlier pages are not copied again for every new one.
const fetchPrescriptionPages = async (
  accessToken: string,
  collected: MobilePrescription[],
  cursor?: string,
): Promise<MobilePrescription[]> => {
  const {data} = await apiClient.get<PrescriptionPage>(ENDPOINT, {
    params: {limit: PAGE_SIZE, cursor},
    headers: withAuthHeaders(accessToken),
  });
  collected.push(...(data.prescriptions ?? []));
  if (!data.hasMore) {
    return collected;
  }
  if (!data.nextCursor || data.nextCursor === cursor) {
    throw new Error('Prescription pagination did not advance');
  }
  return fetchPrescriptionPages(accessToken, collected, data.nextCursor);
};

export const prescriptionApi = {
  /**
   * Every prescription the owner may read, across all of their companions.
   * Follows `nextCursor` while `hasMore`: the caller filters to one companion,
   * so stopping at the first page could hide that animal's rows entirely and
   * render "no prescriptions" as a false statement. A page that claims more
   * rows without a new cursor is a broken contract and throws rather than
   * returning a list that looks complete.
   */
  list(accessToken: string): Promise<MobilePrescription[]> {
    return fetchPrescriptionPages(accessToken, []);
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
