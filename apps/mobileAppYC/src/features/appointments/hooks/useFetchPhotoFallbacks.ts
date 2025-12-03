import {useEffect} from 'react';
import {isDummyPhoto} from '@/features/appointments/utils/photoUtils';

/**
 * Hook for fetching business photo fallbacks when primary photos are missing
 * Consolidates photo fetching effect used in multiple appointment screens
 */
export const useFetchPhotoFallbacks = (
  appointments: any[],
  businessMap: Map<string, any>,
  requestBusinessPhoto: (googlePlacesId: string, businessId: string) => void,
) => {
  useEffect(() => {
    appointments.forEach(apt => {
      const biz = businessMap.get(apt.businessId);
      const googlePlacesId = biz?.googlePlacesId ?? apt.businessGooglePlacesId ?? null;
      const photoCandidate = (biz?.photo ?? apt.businessPhoto) as string | null | undefined;
      const needsPhoto = (!photoCandidate || isDummyPhoto(photoCandidate)) && googlePlacesId;
      if (needsPhoto && googlePlacesId) {
        requestBusinessPhoto(googlePlacesId, apt.businessId);
      }
    });
  }, [appointments, businessMap, requestBusinessPhoto]);
};
