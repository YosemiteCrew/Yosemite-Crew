import RNFetchBlob from 'react-native-blob-util';
import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';

export interface PresignedUploadResponse {
  url: string;
  key: string;
}

interface PresignedRequestParams {
  accessToken: string;
  mimeType: string;
}

const requestPresignedUrl = async (
  endpoint: string,
  {accessToken, mimeType}: PresignedRequestParams,
): Promise<PresignedUploadResponse> => {
  console.log('[UploadService] Presigned request', {
    endpoint,
    mimeType,
    timestamp: new Date().toISOString(),
  });

  const response = await apiClient.post<PresignedUploadResponse>(
    endpoint,
    {mimeType},
    {
      headers: withAuthHeaders(accessToken),
    },
  );

  console.log('[UploadService] Presigned response', {
    endpoint,
    status: response.status,
    data: response.data,
  });

  return response.data;
};

export const requestParentProfileUploadUrl = async (params: PresignedRequestParams) =>
  requestPresignedUrl('/fhir/v1/parent/profile/presigned', params);

export const requestCompanionProfileUploadUrl = async (
  params: PresignedRequestParams,
) => requestPresignedUrl('/fhir/v1/companion/profile/presigned', params);

interface UploadToPresignedUrlParams {
  filePath: string;
  mimeType: string;
  url: string;
}

export const uploadFileToPresignedUrl = async ({
  filePath,
  mimeType,
  url,
}: UploadToPresignedUrlParams): Promise<void> => {
  console.log('[UploadService] Upload start', {url, mimeType, filePath});
  const response = await RNFetchBlob.fetch(
    'PUT',
    url,
    {
      'Content-Type': mimeType,
    },
    RNFetchBlob.wrap(filePath),
  );

  const status = response.info().status;
  console.log('[UploadService] Upload response', {url, status});
  if (status >= 400) {
    throw new Error(`Failed to upload file. Status: ${status}`);
  }
};
