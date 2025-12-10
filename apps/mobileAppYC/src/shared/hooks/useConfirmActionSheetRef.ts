import React from 'react';
import type {ConfirmActionBottomSheetRef} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';

export const useConfirmActionSheetRef = (
  ref: React.ForwardedRef<{open: () => void; close: () => void}>,
  onConfirm?: () => void,
) => {
  const sheetRef = React.useRef<ConfirmActionBottomSheetRef>(null);

  React.useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.open(),
    close: () => sheetRef.current?.close(),
  }));

  const handleConfirm = React.useCallback(() => {
    sheetRef.current?.close();
    onConfirm?.();
  }, [onConfirm]);

  return {sheetRef, handleConfirm};
};

export default useConfirmActionSheetRef;

