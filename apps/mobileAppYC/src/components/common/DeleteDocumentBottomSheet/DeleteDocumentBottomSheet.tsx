import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {StyleSheet} from 'react-native';
import ConfirmActionBottomSheet, {
  type ConfirmActionBottomSheetRef,
} from '@/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {useTheme} from '@/hooks';

export interface DeleteDocumentBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface DeleteDocumentBottomSheetProps {
  documentTitle?: string;
  onCancel?: () => void;
  onDelete: () => Promise<void> | void;
  title?: string;
  message?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export const DeleteDocumentBottomSheet = forwardRef<
  DeleteDocumentBottomSheetRef,
  DeleteDocumentBottomSheetProps
>(({documentTitle = 'this document', onCancel, onDelete, title, message, primaryLabel, secondaryLabel}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sheetRef = useRef<ConfirmActionBottomSheetRef>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => {
      sheetRef.current?.open();
    },
    close: () => {
      sheetRef.current?.close();
    },
  }));

  const handleClose = () => {
    sheetRef.current?.close();
  };

  const handleCancel = () => {
    handleClose();
    onCancel?.();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      handleClose();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmActionBottomSheet
      ref={sheetRef}
      snapPoints={['35%']}
      title={title ?? 'Delete file'}
      message={
        message ?? `Are you sure you want to delete the file ${documentTitle}?`
      }
      primaryButton={{
        label: isDeleting ? 'Deleting...' : primaryLabel ?? 'Delete',
        onPress: handleDelete,
        tintColor: theme.colors.secondary,
        textStyle: styles.deleteText,
        style: styles.deleteButton,
        disabled: isDeleting,
        loading: isDeleting,
      }}
      secondaryButton={{
        label: secondaryLabel ?? 'Cancel',
        onPress: handleCancel,
        tintColor: theme.colors.surface,
        textStyle: styles.buttonText,
        style: styles.cancelButton,
        forceBorder: true,
        borderColor: theme.colors.borderMuted,
        disabled: isDeleting,
      }}
    />
  );
});

DeleteDocumentBottomSheet.displayName = 'DeleteDocumentBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    cancelButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
    },
    deleteButton: {
      flex: 1,
    },
    buttonText: {
      ...theme.typography.buttonH6Clash19,
      color: theme.colors.secondary,
      textAlign: 'center',
    },
    deleteText: {
      ...theme.typography.buttonH6Clash19,
      textAlign: 'center',
      color: theme.colors.white,
    },
  });

export default DeleteDocumentBottomSheet;
