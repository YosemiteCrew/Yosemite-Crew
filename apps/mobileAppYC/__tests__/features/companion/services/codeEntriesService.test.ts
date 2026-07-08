import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {
  fetchSpeciesCodeEntries,
  fetchBreedCodeEntries,
} from '@/features/companion/services/codeEntriesService';

jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
  withAuthHeaders: jest.fn(token => ({Authorization: `Bearer ${token}`})),
}));

describe('codeEntriesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchSpeciesCodeEntries', () => {
    it('fetches species entries with the correct params and auth headers', async () => {
      const entries = [{code: 'DOG', display: 'Dog'}];
      (apiClient.get as jest.Mock).mockResolvedValue({data: entries});

      const result = await fetchSpeciesCodeEntries('token-123');

      expect(apiClient.get).toHaveBeenCalledWith('/v1/codes/mobile/entries', {
        params: {system: 'YOSEMITECODE', type: 'SPECIES'},
        headers: {Authorization: 'Bearer token-123'},
      });
      expect(withAuthHeaders).toHaveBeenCalledWith('token-123');
      expect(result).toEqual(entries);
    });

    it('returns an empty array when the response data is not an array', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({data: null});

      const result = await fetchSpeciesCodeEntries('token-123');

      expect(result).toEqual([]);
    });
  });

  describe('fetchBreedCodeEntries', () => {
    it('fetches breed entries with the species query and correct params', async () => {
      const entries = [
        {code: 'LAB', display: 'Labrador', meta: {species: 'DOG'}},
      ];
      (apiClient.get as jest.Mock).mockResolvedValue({data: entries});

      const result = await fetchBreedCodeEntries('DOG', 'token-456');

      expect(apiClient.get).toHaveBeenCalledWith('/v1/codes/mobile/entries', {
        params: {system: 'YOSEMITECODE', type: 'BREED', q: 'DOG'},
        headers: {Authorization: 'Bearer token-456'},
      });
      expect(result).toEqual(entries);
    });

    it('returns an empty array when the response data is not an array', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({data: undefined});

      const result = await fetchBreedCodeEntries('CAT', 'token-456');

      expect(result).toEqual([]);
    });
  });
});
