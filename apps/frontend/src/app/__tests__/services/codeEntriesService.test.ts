import {
  fetchSpeciesCodeEntries,
  fetchBreedCodeEntries,
} from '@/app/features/companions/services/codeEntriesService';
import { getData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
}));

const mockedGetData = getData as jest.Mock;

describe('codeEntriesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchSpeciesCodeEntries', () => {
    it('returns array data from response', async () => {
      const mockData = [
        { code: 'DOG', display: 'Dog' },
        { code: 'CAT', display: 'Cat' },
      ];
      mockedGetData.mockResolvedValue({ data: mockData });

      const result = await fetchSpeciesCodeEntries();

      expect(mockedGetData).toHaveBeenCalledWith('/v1/codes/entries', {
        system: 'YOSEMITECODE',
        type: 'SPECIES',
      });
      expect(result).toEqual(mockData);
    });

    it('returns empty array when response data is not an array', async () => {
      mockedGetData.mockResolvedValue({ data: null });
      const result = await fetchSpeciesCodeEntries();
      expect(result).toEqual([]);
    });

    it('returns empty array when response data is an object (not array)', async () => {
      mockedGetData.mockResolvedValue({ data: { items: [] } });
      const result = await fetchSpeciesCodeEntries();
      expect(result).toEqual([]);
    });

    it('returns empty array when response data is undefined', async () => {
      mockedGetData.mockResolvedValue({ data: undefined });
      const result = await fetchSpeciesCodeEntries();
      expect(result).toEqual([]);
    });

    it('propagates errors from getData', async () => {
      mockedGetData.mockRejectedValue(new Error('Network error'));
      await expect(fetchSpeciesCodeEntries()).rejects.toThrow('Network error');
    });
  });

  describe('fetchBreedCodeEntries', () => {
    it('returns array of breed entries for a species query', async () => {
      const mockData = [
        { code: 'LAB', display: 'Labrador', meta: { species: 'Dog', speciesCode: 'DOG' } },
        { code: 'GSD', display: 'German Shepherd', meta: { speciesCode: 'DOG' } },
      ];
      mockedGetData.mockResolvedValue({ data: mockData });

      const result = await fetchBreedCodeEntries('Dog');

      expect(mockedGetData).toHaveBeenCalledWith('/v1/codes/entries', {
        system: 'YOSEMITECODE',
        type: 'BREED',
        q: 'Dog',
      });
      expect(result).toEqual(mockData);
    });

    it('returns empty array when response data is not an array', async () => {
      mockedGetData.mockResolvedValue({ data: { breeds: [] } });
      const result = await fetchBreedCodeEntries('Cat');
      expect(result).toEqual([]);
    });

    it('returns empty array when response data is null', async () => {
      mockedGetData.mockResolvedValue({ data: null });
      const result = await fetchBreedCodeEntries('Horse');
      expect(result).toEqual([]);
    });

    it('passes speciesQuery as the q param', async () => {
      mockedGetData.mockResolvedValue({ data: [] });
      await fetchBreedCodeEntries('EQUINE');
      expect(mockedGetData).toHaveBeenCalledWith(
        '/v1/codes/entries',
        expect.objectContaining({ q: 'EQUINE' })
      );
    });

    it('propagates errors from getData', async () => {
      mockedGetData.mockRejectedValue(new Error('Service unavailable'));
      await expect(fetchBreedCodeEntries('Dog')).rejects.toThrow('Service unavailable');
    });
  });
});
