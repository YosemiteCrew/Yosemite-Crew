import { listApiKeys, createApiKey, revokeApiKey } from '@/app/services/developerApiKeys';
import { getData, postData, deleteData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
  postData: jest.fn(),
  deleteData: jest.fn(),
}));

const getDataMock = getData as jest.Mock;
const postDataMock = postData as jest.Mock;
const deleteDataMock = deleteData as jest.Mock;

describe('developerApiKeys service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listApiKeys', () => {
    it('returns the data array from the response envelope', async () => {
      getDataMock.mockResolvedValue({ data: { data: [{ id: 'k1' }] } });
      await expect(listApiKeys()).resolves.toEqual([{ id: 'k1' }]);
      expect(getDataMock).toHaveBeenCalledWith('/v1/developers/api-keys');
    });

    it('falls back to an empty array when the body is missing', async () => {
      getDataMock.mockResolvedValue({ data: undefined });
      await expect(listApiKeys()).resolves.toEqual([]);
    });
  });

  describe('createApiKey', () => {
    it('posts the payload and returns the issued key', async () => {
      postDataMock.mockResolvedValue({ data: { id: 'k', apiKey: 'yc_live_x' } });
      const result = await createApiKey({ name: 'CI', environment: 'live' });
      expect(postDataMock).toHaveBeenCalledWith('/v1/developers/api-keys', {
        name: 'CI',
        environment: 'live',
      });
      expect(result).toEqual({ id: 'k', apiKey: 'yc_live_x' });
    });
  });

  describe('revokeApiKey', () => {
    it('deletes by id', async () => {
      deleteDataMock.mockResolvedValue({});
      await revokeApiKey('k1');
      expect(deleteDataMock).toHaveBeenCalledWith('/v1/developers/api-keys/k1');
    });
  });
});
