import {passportApi} from '@/features/passport/services/passportService';
import apiClient from '@/shared/services/apiClient';

jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock('@/config/variables', () => ({
  API_CONFIG: {baseUrl: 'https://test-api.example.com'},
}));

describe('passportApi', () => {
  const mockPatientId = 'companion-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the passport for a patient from the public endpoint', async () => {
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
    (apiClient.get as jest.Mock).mockResolvedValue({data: mockPassport});

    const result = await passportApi.fetchPassport(mockPatientId);

    expect(apiClient.get).toHaveBeenCalledWith(
      `/public/pet-passport/${mockPatientId}`,
    );
    expect(result).toEqual(mockPassport);
  });

  it('propagates errors from the API call', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Not found'));

    await expect(passportApi.fetchPassport(mockPatientId)).rejects.toThrow(
      'Not found',
    );
  });

  describe('getApplePassUrl', () => {
    it('builds the direct wallet-download URL from API_CONFIG.baseUrl', () => {
      const url = passportApi.getApplePassUrl(mockPatientId);

      expect(url).toBe(
        `https://test-api.example.com/public/pet-passport/${mockPatientId}/wallet/apple`,
      );
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('getGoogleWalletUrl', () => {
    it('fetches the Google Wallet save URL from the public endpoint', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {saveUrl: 'https://pay.google.com/gp/v/save/mock-jwt'},
      });

      const result = await passportApi.getGoogleWalletUrl(mockPatientId);

      expect(apiClient.get).toHaveBeenCalledWith(
        `/public/pet-passport/${mockPatientId}/wallet/google`,
      );
      expect(result).toBe('https://pay.google.com/gp/v/save/mock-jwt');
    });

    it('propagates errors from the API call', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Not found'));

      await expect(
        passportApi.getGoogleWalletUrl(mockPatientId),
      ).rejects.toThrow('Not found');
    });
  });
});
