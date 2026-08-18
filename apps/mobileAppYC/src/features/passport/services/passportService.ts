import RNFS from 'react-native-fs';
import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import type {PetPassportDTO} from '@yosemite-crew/types';

// Pet-parent surface. The parent is already authenticated here, so these are
// owner-scoped authenticated routes rather than the public QR endpoint: the
// backend proves the caller is the pet's primary parent and derives the
// organisation from the pet's own membership. Using the public route instead
// would mean shipping a bearer share token in the app.
//
// apiClient does not attach credentials on its own, so every call below passes
// the caller's access token explicitly.
const PARENT_PASSPORT_ENDPOINT = '/v1/pet-passport/mobile/companion';

const applePassPath = (patientId: string): string =>
  `${PARENT_PASSPORT_ENDPOINT}/${patientId}/wallet/apple`;
const googlePassPath = (patientId: string): string =>
  `${PARENT_PASSPORT_ENDPOINT}/${patientId}/wallet/google`;

// RNFS downloads bypass the axios instance, so the path has to be resolved
// against the same base URL by hand. The slashes are trimmed with a loop rather
// than /\/+$/ and /^\/+/, whose unbounded repetition backtracks super-linearly
// on a pathological input (Sonar S8786).
const trimSlashes = (value: string, leading: boolean): string => {
  let start = 0;
  let end = value.length;
  if (leading) {
    while (start < end && value.charAt(start) === '/') start += 1;
  } else {
    while (end > start && value.charAt(end - 1) === '/') end -= 1;
  }
  return value.slice(start, end);
};

const absoluteUrl = (path: string): string =>
  `${trimSlashes(String(apiClient.defaults.baseURL ?? ''), false)}/${trimSlashes(
    path,
    true,
  )}`;

export const passportApi = {
  async fetchPassport(
    patientId: string,
    accessToken: string,
  ): Promise<PetPassportDTO> {
    const response = await apiClient.get<PetPassportDTO>(
      `${PARENT_PASSPORT_ENDPOINT}/${patientId}`,
      {headers: withAuthHeaders(accessToken)},
    );
    return response.data;
  },

  /**
   * Downloads the signed .pkpass to a local file and returns its path.
   *
   * The endpoint requires an Authorization header and `Linking.openURL` cannot
   * attach one, so handing it the remote URL would simply 401. Downloading it
   * first (the same way the clinical packet PDF is fetched) gives a file:// URL
   * that iOS opens straight into Wallet.
   */
  async downloadApplePass(
    patientId: string,
    accessToken: string,
  ): Promise<string> {
    const dir = RNFS.TemporaryDirectoryPath ?? RNFS.CachesDirectoryPath;
    const target = `${dir}/pet-passport-${patientId}.pkpass`;
    await RNFS.mkdir(dir);
    const result = await RNFS.downloadFile({
      fromUrl: absoluteUrl(applePassPath(patientId)),
      toFile: target,
      headers: withAuthHeaders(accessToken) as Record<string, string>,
      discretionary: true,
    }).promise;
    if (result.statusCode && result.statusCode >= 400) {
      throw new Error('Unable to download the Apple Wallet pass.');
    }
    return `file://${target}`;
  },

  // Google Wallet needs a fetch first: the backend mints a signed
  // save-to-wallet JWT and returns it as JSON ({saveUrl}), which the caller
  // then opens. That URL is already a Google-hosted capability link, so it is
  // safe to hand to Linking.
  async getGoogleWalletUrl(
    patientId: string,
    accessToken: string,
  ): Promise<string> {
    const response = await apiClient.get<{saveUrl: string}>(
      googlePassPath(patientId),
      {headers: withAuthHeaders(accessToken)},
    );
    return response.data.saveUrl;
  },
};
