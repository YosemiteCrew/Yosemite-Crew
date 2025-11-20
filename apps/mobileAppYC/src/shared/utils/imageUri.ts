const CDN_BASE = 'https://d2kyjiikho62xx.cloudfront.net/';

const isRemote = (value?: string | null) =>
  typeof value === 'string' && /^https?:\/\//i.test(value);

const tryExtractUploadKey = (value: string): string | null => {
  const trimmed = value.replace(/^file:\/\//, '').replace(/^\/+/, '');
  const match = trimmed.match(
    /((?:temp\/uploads|companion\/)[^?]*\.(?:jpg|jpeg|png|webp|heic|heif))/i,
  );
  return match?.[1] ?? null;
};

export const normalizeImageUri = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  if (isRemote(value)) {
    return value;
  }

  const uploadKey = tryExtractUploadKey(value);
  if (uploadKey) {
    return `${CDN_BASE.replace(/\/+$/, '')}/${uploadKey.replace(/^\/+/, '')}`;
  }

  // Leave other local/asset paths unchanged so local previews continue to work.
  return value;
};

// Prefer normalizeImageUri for raw strings; resolveImageSource wraps this for ImageSourcePropType.
