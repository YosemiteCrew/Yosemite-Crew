import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {StyleSheet} from 'react-native';

import ConfirmActionBottomSheet, {
  type ConfirmActionBottomSheetRef,
} from '@/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {useTheme} from '@/hooks';

export interface DeleteProfileBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface DeleteProfileBottomSheetProps {
  companionName: string;
  onCancel?: () => void;
  onDelete: () => void;
}

export const DeleteProfileBottomSheet = forwardRef<
  DeleteProfileBottomSheetRef,
  DeleteProfileBottomSheetProps
>(({companionName, onCancel, onDelete}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const sheetRef = useRef<ConfirmActionBottomSheetRef>(null);

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

  const handleDelete = () => {
    onDelete();
    handleClose();
  };

  return (
    <ConfirmActionBottomSheet
      ref={sheetRef}
      snapPoints={['35%', '45%']}
      title="Delete profile"
      message={`Are you sure you want to delete ${companionName}'s profile?`}
      primaryButton={{
        label: 'Delete',
        onPress: handleDelete,
        tintColor: theme.colors.secondary,
        textStyle: styles.deleteButtonText,
        style: styles.button,
      }}
      secondaryButton={{
        label: 'Cancel',
        onPress: handleCancel,
        tintColor: theme.colors.surface,
        textStyle: styles.cancelButtonText,
        style: styles.button,
        forceBorder: true,
        borderColor: theme.colors.border,
      }}
      containerStyle={styles.container}
      buttonContainerStyle={styles.actionsRow}
      titleStyle={styles.title}
      messageStyle={styles.subtitle}
    />
  );
});

DeleteProfileBottomSheet.displayName = 'DeleteProfileBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: theme.spacing['5'],
      justifyContent: 'space-around',
    },
    title: {
      ...theme.typography.h4,
      color: theme.colors.secondary,
      textAlign: 'center',
      marginBottom: theme.spacing['2'],
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing['6'],
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing['4'],
            marginBottom: theme.spacing['4'],
    },
    button: {
      flex: 1,
      height: 52,
    },
    cancelButtonText: {
      ...theme.typography.button,
      color: theme.colors.secondary,
    },
    deleteButtonText: {
      ...theme.typography.button,
      color: theme.colors.white,
    },
  });

export default DeleteProfileBottomSheet;
