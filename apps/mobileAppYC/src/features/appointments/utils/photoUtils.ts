/**
 * Shared photo and image utilities for appointments
 */

/**
 * Detect if a photo URL is a dummy/placeholder image
 */
const KNOWN_DUMMY_HOSTS = ['example.com', 'placeholder.com'];

const parseHostname = (value: string): string | null => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    try {
      return new URL(`https://${value}`).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
};

const isKnownDummyHost = (hostname: string): boolean => {
  return KNOWN_DUMMY_HOSTS.some(allowed => hostname === allowed || hostname.endsWith(`.${allowed}`));
};

export const isDummyPhoto = (photo?: string | null): boolean => {
  if (typeof photo !== 'string') return false;
  const trimmed = photo.trim();
  if (!trimmed) return false;

  const hostname = parseHostname(trimmed);
  if (hostname && isKnownDummyHost(hostname)) {
    return true;
  }

  const pathOrValue = (() => {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return trimmed;
    }
  })();

  return pathOrValue.toLowerCase().includes('placeholder');
};

/**
 * Determine if a photo needs to be fetched from a fallback source
 */
export const needsPhotoFallback = (
  photo?: string | null,
  fallbackPhoto?: string | null,
  googlePlacesId?: string | null,
): boolean => {
  return (!photo || isDummyPhoto(photo)) && !fallbackPhoto && !!googlePlacesId;
};
