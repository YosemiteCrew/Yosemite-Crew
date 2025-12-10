import {useEffect} from 'react';
import {useDispatch} from 'react-redux';
import type {AppDispatch} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';

/**
 * Hook that automatically selects the first companion if none is selected
 * Prevents disabled CTAs due to missing companion selection
 */
export const useAutoSelectCompanion = (
  companions: any[],
  selectedCompanionId: string | null | undefined,
) => {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      const fallbackId =
        companions[0]?.id ??
        companions[0]?._id ??
        companions[0]?.identifier?.[0]?.value;
      if (fallbackId) {
        dispatch(setSelectedCompanion(fallbackId));
      }
    }
  }, [companions, selectedCompanionId, dispatch]);
};
