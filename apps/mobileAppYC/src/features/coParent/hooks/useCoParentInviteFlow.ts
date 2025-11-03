import {useRef, useCallback} from 'react';
import type {AddCoParentBottomSheetRef} from '../components/AddCoParentBottomSheet/AddCoParentBottomSheet';
import type {CoParentInviteBottomSheetRef} from '../components/CoParentInviteBottomSheet/CoParentInviteBottomSheet';

interface UseCoParentInviteFlowProps {
  onInviteComplete?: () => void;
}

export const useCoParentInviteFlow = ({onInviteComplete}: UseCoParentInviteFlowProps = {}) => {
  const addCoParentSheetRef = useRef<AddCoParentBottomSheetRef>(null);
  const coParentInviteSheetRef = useRef<CoParentInviteBottomSheetRef>(null);

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
