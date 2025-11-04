import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {ConfirmActionBottomSheet, ConfirmActionBottomSheetRef} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';

export interface DeleteCoParentBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface DeleteCoParentBottomSheetProps {
  coParentName?: string;
  onDelete?: () => void;
  onCancel?: () => void;
  onSheetChange?: (index: number) => void;
}

export const DeleteCoParentBottomSheet = forwardRef<
  DeleteCoParentBottomSheetRef,
  DeleteCoParentBottomSheetProps
>(({coParentName, onDelete, onCancel, onSheetChange}, ref) => {
  const bottomSheetRef = useRef<ConfirmActionBottomSheetRef>(null);

  useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.open(),
    close: () => bottomSheetRef.current?.close(),
  }));

  const handleDelete = () => {
    bottomSheetRef.current?.close();
    onDelete?.();
  };

  const handleCancel = () => {
    bottomSheetRef.current?.close();
    onCancel?.();
  };

  return (
    <ConfirmActionBottomSheet
      ref={bottomSheetRef}
      title="Delete Co-Parent?"
      message={`Are you sure you want to delete ${coParentName} as co-parent?`}
      primaryButton={{
        label: 'Delete',
        onPress: handleDelete,
      }}
      secondaryButton={{
        label: 'Cancel',
        onPress: handleCancel,
      }}
      onSheetChange={onSheetChange}
      snapPoints={['35%']}
    />
  );
});

export default DeleteCoParentBottomSheet;
