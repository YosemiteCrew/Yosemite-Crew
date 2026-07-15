import apiClient from '@/shared/services/apiClient';
import {API_CONFIG} from '@/config/variables';
import type {PetPassportDTO} from '@yosemite-crew/types';

// Public, unauthenticated endpoint - same one the wallet-pass QR resolves to.
// It exposes the pet's full signed record (owner view), keyed only by patientId.
const PUBLIC_PASSPORT_ENDPOINT = '/public/pet-passport';

// NOT YET IMPLEMENTED ON THE BACKEND — see handoff notes.
// Mirrors the staff-only wallet endpoints in
// apps/backend/src/routers/pet-passport.router.ts (getApplePass/getGooglePass),
// but under the existing public/owner-scoped router
// (pet-passport-public.router.ts) so a pet parent's phone can reach it without
// an org context, the same way GET /public/pet-passport/:patientId already
// works. Calling these today will 404 until that backend route is added.
const applePassPath = (patientId: string): string =>
  `${PUBLIC_PASSPORT_ENDPOINT}/${patientId}/wallet/apple`;
const googlePassPath = (patientId: string): string =>
  `${PUBLIC_PASSPORT_ENDPOINT}/${patientId}/wallet/google`;

export const passportApi = {
  async fetchPassport(patientId: string): Promise<PetPassportDTO> {
    const response = await apiClient.get<PetPassportDTO>(
      `${PUBLIC_PASSPORT_ENDPOINT}/${patientId}`,
    );
    return response.data;
  },

  // No network call: iOS opens .pkpass URLs directly into Wallet when the
  // server responds with the application/vnd.apple.pkpass content type, the
  // same way the wallet-pass QR flow already works. See applePassPath above
  // for why this 404s until the backend route exists.
  getApplePassUrl(patientId: string): string {
    return `${API_CONFIG.baseUrl}${applePassPath(patientId)}`;
  },

  // Google Wallet requires a fetch first: the backend mints a signed
  // save-to-wallet JWT and returns it as JSON ({saveUrl}), which the caller
  // then opens. See googlePassPath above for why this 404s until the backend
  // route exists.
  async getGoogleWalletUrl(patientId: string): Promise<string> {
    const response = await apiClient.get<{saveUrl: string}>(
      googlePassPath(patientId),
    );
    return response.data.saveUrl;
  },
};
