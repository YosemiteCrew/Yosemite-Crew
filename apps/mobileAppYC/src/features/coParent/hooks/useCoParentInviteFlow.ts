import {useRef, useCallback} from 'react';

interface UseCoParentInviteFlowProps {
  onInviteComplete?: () => void;
}

export const useCoParentInviteFlow = ({onInviteComplete}: UseCoParentInviteFlowProps = {}) => {
  const addCoParentSheetRef = useRef<any>(null);
  const coParentInviteSheetRef = useRef<any>(null);

  const openAddCoParentSheet = useCallback(() => {
    addCoParentSheetRef.current?.open();
  }, []);

  const handleAddCoParentClose = useCallback(() => {
    addCoParentSheetRef.current?.close();
    setTimeout(() => {
      coParentInviteSheetRef.current?.open();
    }, 300);
  }, []);

  const handleInviteAccept = useCallback(() => {
    coParentInviteSheetRef.current?.close();
    onInviteComplete?.();
  }, [onInviteComplete]);

  const handleInviteDecline = useCallback(() => {
    coParentInviteSheetRef.current?.close();
    onInviteComplete?.();
  }, [onInviteComplete]);

  return {
    addCoParentSheetRef,
    coParentInviteSheetRef,
    openAddCoParentSheet,
    handleAddCoParentClose,
    handleInviteAccept,
    handleInviteDecline,
  };
};
