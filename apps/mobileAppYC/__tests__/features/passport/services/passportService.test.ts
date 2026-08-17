import RNFS from 'react-native-fs';
import {passportApi} from '@/features/passport/services/passportService';
import apiClient from '@/shared/services/apiClient';

const BASE_URL = 'https://test-api.example.com';

jest.mock('@/config/variables', () => ({
  API_CONFIG: {baseUrl: 'https://test-api.example.com'},
}));

// Only the axios instance is stubbed - the real `withAuthHeaders` is kept so
// the Authorization assertions below exercise the production header builder
// rather than a copy of it that could drift.
jest.mock('@/shared/services/apiClient', () => {
  const actual = jest.requireActual('@/shared/services/apiClient');
  return {
    __esModule: true,
    ...actual,
    default: {
      get: jest.fn(),
      defaults: {baseURL: 'https://test-api.example.com'},
    },
  };
});

jest.mock('react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp/passport',
  CachesDirectoryPath: '/caches/passport',
  mkdir: jest.fn().mockResolvedValue(undefined),
  downloadFile: jest.fn(() => ({promise: Promise.resolve({statusCode: 200})})),
}));

// `TemporaryDirectoryPath` is typed as a non-optional string, but the service
// falls back to the caches directory when the platform does not provide one.
const mutableRNFS = RNFS as unknown as {
  TemporaryDirectoryPath?: string;
  CachesDirectoryPath?: string;
};

const mockDownloadResult = (result: {statusCode?: number}) => {
  (RNFS.downloadFile as jest.Mock).mockReturnValue({
    promise: Promise.resolve(result),
  });
};

describe('passportApi', () => {
  const mockPatientId = 'companion-123';
  const mockAccessToken = 'mock-access-token';
  // The routes are owner-scoped and authenticated; apiClient attaches nothing
  // on its own, so every call has to carry the caller's bearer token.
  const expectedAuthHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${mockAccessToken}`,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.defaults.baseURL = BASE_URL;
    mutableRNFS.TemporaryDirectoryPath = '/tmp/passport';
    mutableRNFS.CachesDirectoryPath = '/caches/passport';
    mockDownloadResult({statusCode: 200});
  });

  describe('fetchPassport', () => {
    const mockPassport = {
      identity: {
        id: mockPatientId,
        name: 'Rex',
        species: 'DOG',
        breed: 'Labrador',
        sex: 'Male',
      },
      vaccinations: [],
      parasiteTreatments: [],
      rabiesTitrations: [],
      clinicalExams: [],
    };

    it('fetches the passport from the owner-scoped endpoint with the caller bearer token', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({data: mockPassport});

      const result = await passportApi.fetchPassport(
        mockPatientId,
        mockAccessToken,
      );

      expect(apiClient.get).toHaveBeenCalledWith(
        `/v1/pet-passport/mobile/companion/${mockPatientId}`,
        {headers: expectedAuthHeaders},
      );
      expect(result).toEqual(mockPassport);
    });

    it('never puts the access token in the request path', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({data: mockPassport});

      await passportApi.fetchPassport(mockPatientId, mockAccessToken);

      const [requestedPath] = (apiClient.get as jest.Mock).mock.calls[0];
      expect(requestedPath).not.toContain(mockAccessToken);
    });

    it('propagates errors from the API call', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Not found'));

      await expect(
        passportApi.fetchPassport(mockPatientId, mockAccessToken),
      ).rejects.toThrow('Not found');
    });
  });

  describe('downloadApplePass', () => {
    const applePassUrl = `${BASE_URL}/v1/pet-passport/mobile/companion/${mockPatientId}/wallet/apple`;
    const targetFile = `/tmp/passport/pet-passport-${mockPatientId}.pkpass`;

    it('downloads the pass with an Authorization header and returns the local file URL', async () => {
      const result = await passportApi.downloadApplePass(
        mockPatientId,
        mockAccessToken,
      );

      expect(RNFS.mkdir).toHaveBeenCalledWith('/tmp/passport');
      expect(RNFS.downloadFile).toHaveBeenCalledWith({
        fromUrl: applePassUrl,
        toFile: targetFile,
        headers: expectedAuthHeaders,
        discretionary: true,
      });
      expect(result).toBe(`file://${targetFile}`);
    });

    it('carries the credential in the header rather than the download URL', async () => {
      await passportApi.downloadApplePass(mockPatientId, mockAccessToken);

      const [options] = (RNFS.downloadFile as jest.Mock).mock.calls[0];
      expect(options.fromUrl).not.toContain(mockAccessToken);
      expect(options.headers.Authorization).toBe(`Bearer ${mockAccessToken}`);
      // The pass is downloaded rather than handed to the OS as a protected URL,
      // so no unauthenticated axios request is made either.
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('falls back to the caches directory when there is no temporary directory', async () => {
      mutableRNFS.TemporaryDirectoryPath = undefined;

      const result = await passportApi.downloadApplePass(
        mockPatientId,
        mockAccessToken,
      );

      expect(RNFS.mkdir).toHaveBeenCalledWith('/caches/passport');
      expect(result).toBe(
        `file:///caches/passport/pet-passport-${mockPatientId}.pkpass`,
      );
    });

    it('resolves the download URL against the configured base URL, ignoring a trailing slash', async () => {
      apiClient.defaults.baseURL = `${BASE_URL}/`;

      await passportApi.downloadApplePass(mockPatientId, mockAccessToken);

      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({fromUrl: applePassUrl}),
      );
    });

    it('falls back to a relative URL when the client has no base URL configured', async () => {
      apiClient.defaults.baseURL = undefined;

      await passportApi.downloadApplePass(mockPatientId, mockAccessToken);

      expect(RNFS.downloadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fromUrl: `/v1/pet-passport/mobile/companion/${mockPatientId}/wallet/apple`,
        }),
      );
    });

    it('throws when the download is rejected by the backend', async () => {
      mockDownloadResult({statusCode: 401});

      await expect(
        passportApi.downloadApplePass(mockPatientId, mockAccessToken),
      ).rejects.toThrow('Unable to download the Apple Wallet pass.');
    });

    it('throws when the download fails server-side', async () => {
      mockDownloadResult({statusCode: 500});

      await expect(
        passportApi.downloadApplePass(mockPatientId, mockAccessToken),
      ).rejects.toThrow('Unable to download the Apple Wallet pass.');
    });

    it('still resolves when the platform reports no status code', async () => {
      mockDownloadResult({});

      await expect(
        passportApi.downloadApplePass(mockPatientId, mockAccessToken),
      ).resolves.toBe(`file://${targetFile}`);
    });

    it('propagates download failures', async () => {
      (RNFS.downloadFile as jest.Mock).mockReturnValue({
        promise: Promise.reject(new Error('Network down')),
      });

      await expect(
        passportApi.downloadApplePass(mockPatientId, mockAccessToken),
      ).rejects.toThrow('Network down');
    });
  });

  describe('getGoogleWalletUrl', () => {
    it('fetches the Google Wallet save URL with the caller bearer token', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {saveUrl: 'https://pay.google.com/gp/v/save/mock-jwt'},
      });

      const result = await passportApi.getGoogleWalletUrl(
        mockPatientId,
        mockAccessToken,
      );

      expect(apiClient.get).toHaveBeenCalledWith(
        `/v1/pet-passport/mobile/companion/${mockPatientId}/wallet/google`,
        {headers: expectedAuthHeaders},
      );
      expect(result).toBe('https://pay.google.com/gp/v/save/mock-jwt');
    });

    it('never puts the access token in the request path', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {saveUrl: 'https://pay.google.com/gp/v/save/mock-jwt'},
      });

      await passportApi.getGoogleWalletUrl(mockPatientId, mockAccessToken);

      const [requestedPath] = (apiClient.get as jest.Mock).mock.calls[0];
      expect(requestedPath).not.toContain(mockAccessToken);
    });

    it('propagates errors from the API call', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Not found'));

      await expect(
        passportApi.getGoogleWalletUrl(mockPatientId, mockAccessToken),
      ).rejects.toThrow('Not found');
    });
  });
});
