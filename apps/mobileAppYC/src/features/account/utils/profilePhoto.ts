import RNFS from 'react-native-fs';
import {normalizeImageUri} from '@/shared/utils/imageUri';

const REMOTE_URI_REGEX = /^https?:\/\//i;

export const isRemoteUri = (uri?: string | null): boolean =>
  typeof uri === 'string' && REMOTE_URI_REGEX.test(uri);

const inferContentType = (path: string): string => {
  const extension = path.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
    case 'heif':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
};

const extractFileTitle = (path: string, fallback: string = 'parent-profile') => {
  const segments = path.split(/[/\\]/);
  const last = segments.at(-1);
  return last && last.trim().length > 0 ? last : `${fallback}.jpg`;
};

const resolveLocalImagePath = async (uri: string): Promise<string> => {
  if (uri.startsWith('content://')) {
    try {
      const stat = await RNFS.stat(uri);
      if (stat.originalFilepath) {
        return stat.originalFilepath;
      }
    } catch (error) {
      console.warn('[ProfilePhoto] Failed to resolve content URI', error);
    }
  }

  return uri.replace('file://', '');
};

export interface PreparedPhotoPayload {
  localFile?: {
    path: string;
    mimeType: string;
    fileName: string;
  } | null;
  remoteUrl?: string | null;
}

export const preparePhotoPayload = async ({
  imageUri,
  existingRemoteUrl,
  fallbackTitle = 'parent-profile',
}: {
  imageUri?: string | null;
  existingRemoteUrl?: string | null;
  fallbackTitle?: string;
}): Promise<PreparedPhotoPayload> => {
  if (!imageUri) {
    return {remoteUrl: existingRemoteUrl ?? null, localFile: null};
  }

  if (isRemoteUri(imageUri)) {
    return {remoteUrl: imageUri, localFile: null};
  }

  const normalizedRemote = normalizeImageUri(imageUri);
  if (normalizedRemote && normalizedRemote !== imageUri && isRemoteUri(normalizedRemote)) {
    return {remoteUrl: normalizedRemote, localFile: null};
  }

  try {
    const resolvedPath = await resolveLocalImagePath(imageUri);

    return {
      localFile: {
        path: resolvedPath,
        mimeType: inferContentType(resolvedPath),
        fileName: extractFileTitle(resolvedPath, fallbackTitle),
      },
      remoteUrl: null,
    };
  } catch (error) {
    console.warn('[ProfilePhoto] Failed to prepare photo payload', error);
    return {remoteUrl: existingRemoteUrl ?? null, localFile: null};
  }
};
