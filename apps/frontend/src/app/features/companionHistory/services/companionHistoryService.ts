import { getData } from '@/app/services/axios';
import {
  CompanionHistoryResponse,
  HistoryEntryType,
} from '@/app/features/companionHistory/types/history';

type FetchCompanionHistoryParams = {
  organisationId: string;
  companionId: string;
  limit?: number;
  cursor?: string | null;
  types?: HistoryEntryType[];
};

export const fetchCompanionHistory = async ({
  organisationId,
  companionId,
  limit = 50,
  cursor,
  types,
}: FetchCompanionHistoryParams): Promise<CompanionHistoryResponse> => {
  if (!organisationId) throw new Error('Organisation ID missing');
  if (!companionId) throw new Error('Companion ID missing');

  const params: Record<string, string | number> = {
    limit,
  };

  if (cursor) {
    params.cursor = cursor;
  }

  if (types?.length) {
    params.types = types.join(',');
  }

  const endpoint = `/v1/companion-history/pms/organisation/${organisationId}/companion/${companionId}`;
  const response = await getData<CompanionHistoryResponse>(endpoint, params);
  return response.data;
};
