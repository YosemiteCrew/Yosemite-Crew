import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';

const CODE_SYSTEM = 'YOSEMITECODE';
const CODES_ENDPOINT = '/v1/codes/entries';

export interface SpeciesCodeEntry {
  code: string;
  display: string;
}

export interface BreedCodeEntry {
  code: string;
  display: string;
  meta?: {
    species?: string;
    speciesCode?: string;
  };
}

export const fetchSpeciesCodeEntries = async (
  accessToken: string,
): Promise<SpeciesCodeEntry[]> => {
  const response = await apiClient.get<SpeciesCodeEntry[]>(CODES_ENDPOINT, {
    params: {
      system: CODE_SYSTEM,
      type: 'SPECIES',
    },
    headers: withAuthHeaders(accessToken),
  });
  return Array.isArray(response.data) ? response.data : [];
};

export const fetchBreedCodeEntries = async (
  speciesQuery: string,
  accessToken: string,
): Promise<BreedCodeEntry[]> => {
  const response = await apiClient.get<BreedCodeEntry[]>(CODES_ENDPOINT, {
    params: {
      system: CODE_SYSTEM,
      type: 'BREED',
      q: speciesQuery,
    },
    headers: withAuthHeaders(accessToken),
  });
  return Array.isArray(response.data) ? response.data : [];
};
