/**
 * Shared photo and image utilities for appointments
 */

/**
 * Detect if a photo URL is a dummy/placeholder image
 */
export const isDummyPhoto = (photo?: string | null): boolean => {
  return typeof photo === 'string' && (photo.includes('example.com') || photo.includes('placeholder'));
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
