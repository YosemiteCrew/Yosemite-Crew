import {useCallback, useState} from 'react';
import {useDispatch} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '@/features/linkedBusinesses';
import {useLazyRef} from '@/shared/hooks/useLazyRef';

/**
 * Hook for managing business photo fallback fetching
 * Handles fetching photos from Google Places when primary photos are missing or dummy
 */
export const useBusinessPhotoFallback = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [businessFallbacks, setBusinessFallbacks] = useState<
    Record<string, {photo?: string | null}>
  >({});
  const requestedPlacesRef = useLazyRef(() => new Set<string>());

  const requestBusinessPhoto = useCallback(
    async (googlePlacesId: string, businessId: string) => {
      if (!googlePlacesId || requestedPlacesRef.current.has(googlePlacesId)) {
        return;
      }
      requestedPlacesRef.current.add(googlePlacesId);
      try {
        const res = await dispatch(
          fetchBusinessDetails(googlePlacesId),
        ).unwrap();
        if (res.photoUrl) {
          setBusinessFallbacks(prev => ({
            ...prev,
            [businessId]: {photo: res.photoUrl},
          }));
          return;
        }
      } catch {
        // Ignore and try fallback image fetch
      }
      try {
        const img = await dispatch(
          fetchGooglePlacesImage(googlePlacesId),
        ).unwrap();
        if (img.photoUrl) {
          setBusinessFallbacks(prev => ({
            ...prev,
            [businessId]: {photo: img.photoUrl},
          }));
        }
      } catch {
        // Swallow errors; UI will use defaults
      }
    },
    [dispatch, requestedPlacesRef],
  );

  const handleAvatarError = useCallback(
    (googlePlacesId: string | null, businessId: string) => {
      if (!googlePlacesId) return;
      requestBusinessPhoto(googlePlacesId, businessId);
    },
    [requestBusinessPhoto],
  );

  return {
    businessFallbacks,
    setBusinessFallbacks,
    requestBusinessPhoto,
    handleAvatarError,
    requestedPlacesRef,
  };
};
