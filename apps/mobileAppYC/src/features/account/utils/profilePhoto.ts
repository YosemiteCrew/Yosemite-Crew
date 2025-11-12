import RNFS from 'react-native-fs';

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
  const last = segments[segments.length - 1];
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
  photo?: {
    contentType: string;
    title?: string;
    data: string;
  };
  existingPhotoUrl?: string | null;
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
    return {existingPhotoUrl: existingRemoteUrl ?? null};
  }

  if (isRemoteUri(imageUri)) {
    return {existingPhotoUrl: imageUri};
  }

  try {
    const resolvedPath = await resolveLocalImagePath(imageUri);
    const base64Data = await RNFS.readFile(resolvedPath, 'base64');

    return {
      photo: {
        contentType: inferContentType(resolvedPath),
        title: extractFileTitle(resolvedPath, fallbackTitle),
        data: base64Data,
      },
    };
  } catch (error) {
    console.warn('[ProfilePhoto] Failed to prepare photo payload', error);
    return {existingPhotoUrl: existingRemoteUrl ?? null};
  }
};
