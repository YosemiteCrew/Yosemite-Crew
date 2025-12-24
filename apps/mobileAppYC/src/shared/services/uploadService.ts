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
  expectedSize?: number | null;
}

const stripFileScheme = (value: string) =>
  value.startsWith('file://') ? value.replace('file://', '') : value;

const decodeFilePath = (path: string): string => {
  try {
    // Decode URL-encoded characters in file paths (e.g., %20 -> space)
    // This is necessary because some file URIs come with URL encoding
    return decodeURIComponent(path);
  } catch {
    // If decoding fails, return original path
    return path;
  }
};

const normalizePath = (filePath: string) => {
  const normalizedPath = stripFileScheme(filePath);
  const isContentUri = filePath.startsWith('content://');
  if (isContentUri) return filePath;
  const hasAbsolutePath = normalizedPath.startsWith('/');
  return hasAbsolutePath ? `file://${normalizedPath}` : normalizedPath;
};

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
    const statSize = stat?.size === undefined ? null : Number(stat.size);
    const statPath = stat?.path ?? path;
    return {size: statSize ?? null, path: statPath};
  } catch {
    return null;
  }
};

const findResolvedPath = async (wrappedPath: string, normalizedPath: string) => {
  const candidates = [wrappedPath, normalizedPath];
  for (const candidate of candidates) {
    const fsResult = await checkFsPath(candidate);
    if (fsResult) {
      return fsResult;
    }
    const blobResult = await checkBlobPath(candidate);
    if (blobResult) {
      return blobResult;
    }
  }
  return null;
};

const applyPathFallbacks = (resolvedResult: {path: string; size: number | null} | null, filePath: string) => {
  let path = resolvedResult?.path ?? null;
  if (!path && filePath.startsWith('content://')) {
    path = filePath;
  }
  if (!path) {
    path = filePath;
  }
  return path;
};

const resolveSizeHint = (
  size: number | null,
  expectedSize: number | undefined,
): number | null => {
  if (Number.isFinite(size) && size != null && size > 0) {
    return size;
  }
  if (typeof expectedSize === 'number' && expectedSize > 0) {
    return expectedSize;
  }
  return null;
};

export const uploadFileToPresignedUrl = async ({
  filePath,
  mimeType,
  url,
  expectedSize,
}: UploadToPresignedUrlParams): Promise<void> => {
  const wrappedPath = normalizePath(filePath);
  const normalizedPath = stripFileScheme(filePath);

  const resolvedResult = await findResolvedPath(wrappedPath, normalizedPath);
  const resolvedPath = applyPathFallbacks(resolvedResult, filePath);
  const sizeHint = resolveSizeHint(
    resolvedResult?.size ?? null,
    expectedSize ?? undefined,
  );

  console.log('[UploadService] Upload start', {
    url,
    mimeType,
    filePath: resolvedPath,
    size: sizeHint ?? 'unknown',
  });

  try {
    const isContentUri = resolvedPath.startsWith('content://');
    let pathForRead = isContentUri ? resolvedPath : stripFileScheme(resolvedPath);

    // Decode URL-encoded characters in file paths (e.g., %20 -> space)
    // This is necessary because file URIs from document picker may be URL-encoded
    pathForRead = decodeFilePath(pathForRead);

    console.log('[UploadService] Pre-reading file content to ensure stability', {
      path: pathForRead,
      size: sizeHint ?? 'unknown',
      isContentUri,
      originalPath: resolvedPath,
    });

    // Read entire file as base64 to verify it's readable and not empty
    // This prevents issues where file handles become invalid during upload
    // or files get garbage collected before upload completes
    let base64Content: string;
    try {
      base64Content = await RNFetchBlob.fs.readFile(pathForRead, 'base64');
    } catch (readError) {
      throw new Error(
        `Failed to read file. Path: ${pathForRead}. Error: ${readError instanceof Error ? readError.message : String(readError)}`,
      );
    }

    if (!base64Content || base64Content.trim().length === 0) {
      throw new Error(
        `File is empty or unreadable. Path: ${pathForRead}. Size reported: ${sizeHint ?? 'unknown'} bytes`,
      );
    }

    // Calculate actual size from base64 (4 base64 chars = 3 bytes)
    const actualSize = Math.ceil((base64Content.length * 3) / 4);
    console.log('[UploadService] File content read successfully', {
      path: pathForRead,
      reportedSize: sizeHint ?? 'unknown',
      actualSize,
      base64Length: base64Content.length,
    });

    if (actualSize === 0) {
      throw new Error(
        `File content is empty after reading. Path: ${pathForRead}. Size reported: ${sizeHint ?? 'unknown'} bytes`,
      );
    }

    console.log('[UploadService] Starting S3 upload with verified file content', {
      path: pathForRead,
      uploadSize: actualSize,
    });

    // Upload using the verified file path
    // Since we've already verified the file is readable and not empty,
    // we can safely use wrap() which streams the file to S3
    const response = await RNFetchBlob.fetch(
      'PUT',
      url,
      {
        'Content-Type': mimeType,
        'Content-Length': actualSize.toString(),
      },
      RNFetchBlob.wrap(pathForRead),
    );

    const status = response.info().status;
    console.log('[UploadService] Upload response', {
      url,
      status,
      uploadedBytes: actualSize,
    });

    if (status >= 400) {
      const responseBody = response.text();
      const responseText = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
      throw new Error(`Failed to upload file. Status: ${status}. Response: ${responseText}`);
    }
  } catch (error) {
    console.error('[UploadService] Upload failed with error', {
      filePath: resolvedPath,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};
