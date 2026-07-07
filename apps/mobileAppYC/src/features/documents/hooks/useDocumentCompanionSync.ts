import {useEffect as useReactEffect} from 'react';
import type {AppDispatch} from '@/app/store';
import {setSelectedCompanion} from '@/features/companion';
import {fetchDocuments} from '@/features/documents/documentSlice';

type UseDocumentCompanionSyncParams = {
  companions: Array<{id: string}>;
  selectedCompanionId: string | null;
  dispatch: AppDispatch;
};

export const useDocumentCompanionSync = ({
  companions,
  selectedCompanionId,
  dispatch,
}: UseDocumentCompanionSyncParams) => {
  useReactEffect(() => {
    if (companions.length > 0 && selectedCompanionId === null) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

  useReactEffect(() => {
    if (selectedCompanionId) {
      dispatch(fetchDocuments({companionId: selectedCompanionId}));
    }
  }, [dispatch, selectedCompanionId]);
};
