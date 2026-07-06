import React, {useImperativeHandle, useMemo, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import CustomBottomSheet, {
  type BottomSheetRef,
} from '@/shared/components/common/BottomSheet/BottomSheet';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import {BottomSheetHeader} from '@/shared/components/common/BottomSheetHeader/BottomSheetHeader';
import {useTheme} from '@/hooks';

export interface TaskRecurringActionSheetRef {
  open: () => void;
  close: () => void;
}

interface TaskRecurringActionSheetProps {
  title: string;
  message?: string;
  primaryLabel: string;
  primaryLoadingLabel: string;
  onPrimary: () => Promise<void> | void;
  secondaryLabel: string;
  secondaryLoadingLabel: string;
  onSecondary: () => Promise<void> | void;
  onCancel?: () => void;
}

export const TaskRecurringActionSheet = ({
  title,
  message,
  primaryLabel,
  primaryLoadingLabel,
  onPrimary,
  secondaryLabel,
  secondaryLoadingLabel,
  onSecondary,
  onCancel,
  ref,
}: TaskRecurringActionSheetProps & {
  ref?: React.Ref<TaskRecurringActionSheetRef>;
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sheetRef = useRef<BottomSheetRef>(null);
  const [primaryBusy, setPrimaryBusy] = useState(false);
  const [secondaryBusy, setSecondaryBusy] = useState(false);

  const isBusy = primaryBusy || secondaryBusy;

  useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.snapToIndex(0),
    close: () => sheetRef.current?.close(),
  }));

  const handleClose = () => {
    sheetRef.current?.close();
    onCancel?.();
  };

  const handlePrimary = async () => {
    setPrimaryBusy(true);
    try {
      await onPrimary();
      sheetRef.current?.close();
    } catch (error) {
      console.error('[TaskRecurringActionSheet] Primary action error:', error);
    } finally {
      setPrimaryBusy(false);
    }
  };

  const handleSecondary = async () => {
    setSecondaryBusy(true);
    try {
      await onSecondary();
      sheetRef.current?.close();
    } catch (error) {
      console.error(
        '[TaskRecurringActionSheet] Secondary action error:',
        error,
      );
    } finally {
      setSecondaryBusy(false);
    }
  };

  return (
    <CustomBottomSheet
      ref={sheetRef}
      snapPoints={['42%', '42%']}
      initialIndex={-1}
      zIndex={100}
      enablePanDownToClose={true}
      enableBackdrop={true}
      enableHandlePanningGesture={true}
      enableContentPanningGesture={false}
      backdropOpacity={0.5}
      backdropAppearsOnIndex={0}
      backdropDisappearsOnIndex={-1}
      backdropPressBehavior="close"
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      contentType="view">
      <View style={styles.container}>
        <BottomSheetHeader
          title={title}
          onClose={handleClose}
          theme={theme}
          showCloseButton={true}
        />

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.buttonStack}>
          <LiquidGlassButton
            title={primaryBusy ? primaryLoadingLabel : primaryLabel}
            onPress={handlePrimary}
            glassEffect="clear"
            tintColor={theme.colors.secondary}
            borderRadius="lg"
            textStyle={styles.primaryButtonText}
            style={styles.button}
            disabled={isBusy}
            loading={primaryBusy}
            shadowIntensity="light"
          />

          <LiquidGlassButton
            title={secondaryBusy ? secondaryLoadingLabel : secondaryLabel}
            onPress={handleSecondary}
            glassEffect="clear"
            tintColor={theme.colors.surface}
            borderRadius="lg"
            textStyle={styles.secondaryButtonText}
            style={styles.button}
            disabled={isBusy}
            loading={secondaryBusy}
            forceBorder={true}
            borderColor={theme.colors.secondary}
            shadowIntensity="light"
          />

          <LiquidGlassButton
            title="Cancel"
            onPress={handleClose}
            glassEffect="clear"
            tintColor={theme.colors.surface}
            borderRadius="lg"
            textStyle={styles.cancelButtonText}
            style={styles.button}
            disabled={isBusy}
            forceBorder={true}
            borderColor={theme.colors.borderMuted}
            shadowIntensity="light"
          />
        </View>
      </View>
    </CustomBottomSheet>
  );
};

TaskRecurringActionSheet.displayName = 'TaskRecurringActionSheet';

const createStyles = (theme: any) =>
  StyleSheet.create({
    background: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.spacing['6'],
      borderTopRightRadius: theme.spacing['6'],
    },
    handle: {
      backgroundColor: theme.colors.borderMuted,
    },
    container: {
      gap: theme.spacing['3'],
      paddingHorizontal: theme.spacing['5'],
      paddingBottom: theme.spacing['8'],
    },
    message: {
      ...theme.typography.titleMedium,
      color: theme.colors.secondary,
      textAlign: 'center',
      paddingBottom: theme.spacing['1'],
    },
    buttonStack: {
      gap: theme.spacing['3'],
    },
    button: {
      width: '100%',
    },
    primaryButtonText: {
      ...theme.typography.buttonH6Clash19,
      textAlign: 'center',
      color: theme.colors.white,
    },
    secondaryButtonText: {
      ...theme.typography.buttonH6Clash19,
      textAlign: 'center',
      color: theme.colors.secondary,
    },
    cancelButtonText: {
      ...theme.typography.buttonH6Clash19,
      textAlign: 'center',
      color: theme.colors.secondary,
    },
  });

export default TaskRecurringActionSheet;
