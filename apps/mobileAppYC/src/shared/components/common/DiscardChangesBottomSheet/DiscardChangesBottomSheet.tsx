import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {ConfirmActionBottomSheet, ConfirmActionBottomSheetRef} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';

export interface DiscardChangesBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface DiscardChangesBottomSheetProps {
  onDiscard: () => void;
  onKeepEditing?: () => void;
  onSheetChange?: (index: number) => void;
}

export const DiscardChangesBottomSheet = forwardRef<
  DiscardChangesBottomSheetRef,
  DiscardChangesBottomSheetProps
>(({onDiscard, onKeepEditing, onSheetChange}, ref) => {
  const bottomSheetRef = useRef<ConfirmActionBottomSheetRef>(null);

  useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.open(),
    close: () => bottomSheetRef.current?.close(),
  }));

  const handleDiscard = () => {
    bottomSheetRef.current?.close();
    onDiscard();
  };

  const handleKeepEditing = () => {
    bottomSheetRef.current?.close();
    onKeepEditing?.();
  };

  return (
    <ConfirmActionBottomSheet
      ref={bottomSheetRef}
      title="Discard changes?"
      message="You have unsaved changes. Are you sure you want to discard them?"
      primaryButton={{
        label: 'Discard',
        onPress: handleDiscard,
      }}
      secondaryButton={{
        label: 'Keep editing',
        onPress: handleKeepEditing,
      }}
      onSheetChange={onSheetChange}
      snapPoints={['35%']}
    />
  );
});

export default DiscardChangesBottomSheet;
