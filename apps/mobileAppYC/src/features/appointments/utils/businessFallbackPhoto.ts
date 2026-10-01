import type {AppDispatch} from '@/app/store';
import {
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '@/features/linkedBusinesses';

/**
 * Looks up a photo for a business that has none of its own: the Places
 * details first and, only when that lookup fails, the Places image. Resolves
 * to null when neither source has a photo.
 */
export const fetchBusinessFallbackPhoto = async (
  dispatch: AppDispatch,
  googlePlacesId: string,
): Promise<string | null> => {
  const details = await dispatch(fetchBusinessDetails(googlePlacesId))
    .unwrap()
    .catch(() => null);
  if (details) {
    return details.photoUrl ?? null;
  }
  const image = await dispatch(fetchGooglePlacesImage(googlePlacesId))
    .unwrap()
    .catch(() => null);
  return image?.photoUrl ?? null;
};
