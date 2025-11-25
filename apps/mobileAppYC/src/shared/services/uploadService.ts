import RNFetchBlob from 'react-native-blob-util';
import RNFS from 'react-native-fs';
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
  const stripFileScheme = (value: string) =>
    value.startsWith('file://') ? value.replace('file://', '') : value;

  const normalizedPath = stripFileScheme(filePath);
  const wrappedPath = filePath.startsWith('content://')
    ? filePath
    : normalizedPath.startsWith('/')
      ? `file://${normalizedPath}`
      : normalizedPath;

  let size: number | null = null;
  let resolvedPath: string | null = null;

  const checkFsPath = async (path: string) => {
    try {
      const barePath = stripFileScheme(path);
      const exists = await RNFS.exists(barePath);
      if (exists) {
        const stats = await RNFS.stat(barePath);
        const parsed = Number(stats.size);
        return {size: Number.isFinite(parsed) ? parsed : null, path: barePath};
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  const checkBlobPath = async (path: string) => {
    try {
      const exists = await RNFetchBlob.fs.exists(path);
      if (!exists) {
        return null;
      }
      const stat = await RNFetchBlob.fs.stat(path);
      const statSize = stat && typeof stat.size !== 'undefined' ? Number(stat.size) : null;
      const statPath = stat?.path ?? path;
      return {size: statSize ?? null, path: statPath};
    } catch {
      return null;
    }
  };

  const candidates = [wrappedPath, normalizedPath];
  for (const candidate of candidates) {
    const fsResult = await checkFsPath(candidate);
    if (fsResult) {
      size = fsResult.size;
      resolvedPath = fsResult.path;
      break;
    }
    const blobResult = await checkBlobPath(candidate);
    if (blobResult) {
      size = blobResult.size;
      resolvedPath = blobResult.path;
      break;
    }
  }

  // Fallback to the original (content://) path even if size is unknown
  if (!resolvedPath && filePath.startsWith('content://')) {
    resolvedPath = filePath;
  }

  // Final fallback: try the original incoming path even if we could not stat it
  if (!resolvedPath) {
    resolvedPath = filePath;
  }

  if (size == null || !Number.isFinite(size) || size <= 0) {
    throw new Error('Local file is empty or unreadable.');
  }

  console.log('[UploadService] Upload start', {
    url,
    mimeType,
    filePath: resolvedPath,
    size,
  });

  const pathForWrap =
    resolvedPath.startsWith('content://') || resolvedPath.startsWith('file://')
      ? resolvedPath
      : `file://${resolvedPath}`;

  const response = await RNFetchBlob.fetch(
    'PUT',
    url,
    {
      'Content-Type': mimeType,
      ...(size != null && Number.isFinite(size) ? {'Content-Length': size.toString()} : {}),
    },
    RNFetchBlob.wrap(pathForWrap),
  );

  const status = response.info().status;
  console.log('[UploadService] Upload response', {url, status});
  if (status >= 400) {
    throw new Error(`Failed to upload file. Status: ${status}`);
  }
};
