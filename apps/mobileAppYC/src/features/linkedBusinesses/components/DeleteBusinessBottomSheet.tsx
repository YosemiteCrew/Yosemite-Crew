import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {ConfirmActionBottomSheet, ConfirmActionBottomSheetRef} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';

export interface DeleteBusinessBottomSheetRef {
  open: (businessName: string) => void;
  close: () => void;
}

interface DeleteBusinessBottomSheetProps {
  onDelete: () => void | Promise<void>;
  onCancel?: () => void;
  onSheetChange?: (index: number) => void;
  loading?: boolean;
}

export const DeleteBusinessBottomSheet = forwardRef<
  DeleteBusinessBottomSheetRef,
  DeleteBusinessBottomSheetProps
>(({onDelete, onCancel, onSheetChange, loading = false}, ref) => {
  const bottomSheetRef = useRef<ConfirmActionBottomSheetRef>(null);
  const [businessName, setBusinessName] = React.useState<string>('');

  useImperativeHandle(ref, () => ({
    open: (name: string) => {
      setBusinessName(name);
      bottomSheetRef.current?.open();
    },
    close: () => bottomSheetRef.current?.close(),
  }));

  const handleDelete = async () => {
    const result = onDelete();
    if (result instanceof Promise) {
      await result;
    }
    bottomSheetRef.current?.close();
  };

  const handleCancel = () => {
    bottomSheetRef.current?.close();
    onCancel?.();
  };

  return (
    <ConfirmActionBottomSheet
      ref={bottomSheetRef}
      title="Delete Business"
      message={`Are you sure you want to remove ${businessName}? This action cannot be undone.`}
      primaryButton={{
        label: 'Delete',
        onPress: handleDelete,
        loading: loading,
      }}
      secondaryButton={{
        label: 'Cancel',
        onPress: handleCancel,
      }}
      onSheetChange={onSheetChange}
      snapPoints={['40%']}
    />
  );
});

DeleteBusinessBottomSheet.displayName = 'DeleteBusinessBottomSheet';

export default DeleteBusinessBottomSheet;
