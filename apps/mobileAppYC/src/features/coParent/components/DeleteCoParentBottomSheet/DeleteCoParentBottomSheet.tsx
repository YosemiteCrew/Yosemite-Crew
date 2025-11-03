import React, {forwardRef, useMemo} from 'react';
import {StyleSheet, View, Text, TouchableOpacity, Image} from 'react-native';
import {ConfirmActionBottomSheet, ConfirmActionBottomSheetRef} from '@/shared/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

export interface DeleteCoParentBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface DeleteCoParentBottomSheetProps {
  coParentName?: string;
  onDelete?: () => void;
  onCancel?: () => void;
  onSheetChange?: (index: number) => void;
  showCloseIcon?: boolean;
}

export const DeleteCoParentBottomSheet = forwardRef<
  DeleteCoParentBottomSheetRef,
  DeleteCoParentBottomSheetProps
>(({coParentName = 'Pika', onDelete, onCancel, onSheetChange, showCloseIcon = false}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bottomSheetRef = React.useRef<ConfirmActionBottomSheetRef>(null);

  React.useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.open(),
    close: () => bottomSheetRef.current?.close(),
  }));

  const handleDelete = () => {
    bottomSheetRef.current?.close();
    onDelete?.();
  };

  const handleClose = () => {
    bottomSheetRef.current?.close();
    onCancel?.();
  };

  return (
    <ConfirmActionBottomSheet
      ref={bottomSheetRef}
      title="Delete Co-Parent?"
      snapPoints={['35%']}
      primaryButton={{
        label: 'Delete',
        onPress: handleDelete,
      }}
      secondaryButton={{
        label: 'Cancel',
        onPress: () => {
          bottomSheetRef.current?.close();
          onCancel?.();
        },
      }}
      onSheetChange={onSheetChange}
      containerStyle={styles.headerContainer}>
      <View style={styles.headerRow}>
        {showCloseIcon && (
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Image source={Images.crossIcon} style={styles.closeIcon} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.message}>
          Are you sure you want to delete {coParentName} as co-parent?
        </Text>
      </View>
    </ConfirmActionBottomSheet>
  );
});

const createStyles = (theme: any) =>
  StyleSheet.create({
    headerContainer: {
      gap: 0,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: theme.spacing[4],
      paddingTop: theme.spacing[2],
      marginBottom: theme.spacing[2],
    },
    closeButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeIcon: {
      width: 20,
      height: 20,
      resizeMode: 'contain',
      tintColor: theme.colors.secondary,
    },
    content: {
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[2],
    },
    message: {
      ...theme.typography.bodyMedium,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
  });

export default DeleteCoParentBottomSheet;
