import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import CustomBottomSheet, {
  type BottomSheetRef,
} from '@/components/common/BottomSheet/BottomSheet';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';
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

  const bottomSheetRef = useRef<BottomSheetRef>(null);

  useImperativeHandle(ref, () => ({
    open: () => {
      bottomSheetRef.current?.snapToIndex(0);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleClose = () => {
    bottomSheetRef.current?.close();
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
    <CustomBottomSheet
      ref={bottomSheetRef}
      snapPoints={['35%','45%']}
      initialIndex={-1}
      style={styles.bottomSheet}
      enablePanDownToClose
      enableBackdrop
      backdropOpacity={0.5}
      backdropPressBehavior="close"
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.bottomSheetHandle}>
      <View style={styles.container}>
        <Text style={styles.title}>Delete profile</Text>
        <Text style={styles.subtitle}>
          Are you sure you want to delete {companionName}'s profile?
        </Text>
        <View style={styles.actionsRow}>
          <LiquidGlassButton
            title="Cancel"
            onPress={handleCancel}
            glassEffect="clear"
            forceBorder
            borderColor={theme.colors.border}
            tintColor={theme.colors.surface}
            borderRadius="lg"
            textStyle={styles.cancelButtonText}
            style={styles.button}
          />
          <LiquidGlassButton
            title="Delete"
            onPress={handleDelete}
            glassEffect="clear"
            tintColor={theme.colors.secondary}
            borderRadius="lg"
            textStyle={styles.deleteButtonText}
            style={styles.button}
          />
        </View>
      </View>
    </CustomBottomSheet>
  );
});

DeleteProfileBottomSheet.displayName = 'DeleteProfileBottomSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    bottomSheet: {
      zIndex: 1000,
    },
    bottomSheetBackground: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.borderRadius['3xl'],
      borderTopRightRadius: theme.borderRadius['3xl'],
    },
    bottomSheetHandle: {
      backgroundColor: theme.colors.borderMuted,
    },
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