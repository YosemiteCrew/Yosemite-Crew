import apiClient from '@/shared/services/apiClient';
import {API_CONFIG} from '@/config/variables';
import type {PetPassportDTO} from '@yosemite-crew/types';

// Pet-parent surface. The parent is already authenticated here, so these are
// owner-scoped authenticated routes rather than the public QR endpoint: the
// backend proves the caller is the pet's primary parent and derives the
// organisation from the pet's own membership. Using the public route instead
// would mean shipping a bearer share token in the app.
const PARENT_PASSPORT_ENDPOINT = '/v1/pet-passport/mobile/companion';

const applePassPath = (patientId: string): string =>
  `${PARENT_PASSPORT_ENDPOINT}/${patientId}/wallet/apple`;
const googlePassPath = (patientId: string): string =>
  `${PARENT_PASSPORT_ENDPOINT}/${patientId}/wallet/google`;

export const passportApi = {
  async fetchPassport(patientId: string): Promise<PetPassportDTO> {
    const response = await apiClient.get<PetPassportDTO>(
      `${PARENT_PASSPORT_ENDPOINT}/${patientId}`,
    );
    return response.data;
  },

  // No network call: iOS opens .pkpass URLs directly into Wallet when the
  // server responds with the application/vnd.apple.pkpass content type, the
  // same way the wallet-pass QR flow already works.
  getApplePassUrl(patientId: string): string {
    return `${API_CONFIG.baseUrl}${applePassPath(patientId)}`;
  },

  // Google Wallet requires a fetch first: the backend mints a signed
  // save-to-wallet JWT and returns it as JSON ({saveUrl}), which the caller
  // then opens.
  async getGoogleWalletUrl(patientId: string): Promise<string> {
    const response = await apiClient.get<{saveUrl: string}>(
      googlePassPath(patientId),
    );
    return response.data.saveUrl;
  },
};
