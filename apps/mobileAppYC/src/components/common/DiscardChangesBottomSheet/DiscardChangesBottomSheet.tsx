import React, {forwardRef, useImperativeHandle, useRef, useMemo} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {ConfirmActionBottomSheet, ConfirmActionBottomSheetRef} from '@/components/common/ConfirmActionBottomSheet/ConfirmActionBottomSheet';
import {useTheme} from '@/hooks';

export interface DiscardChangesBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface DiscardChangesBottomSheetProps {
  onDiscard: () => void;
  onKeepEditing?: () => void;
}

export const DiscardChangesBottomSheet = forwardRef<
  DiscardChangesBottomSheetRef,
  DiscardChangesBottomSheetProps
>(({onDiscard, onKeepEditing}, ref) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
      snapPoints={['250%']}
      primaryButton={{
        label: "Discard",
        onPress: handleDiscard,
      }}
      secondaryButton={{
        label: "Keep editing",
        onPress: handleKeepEditing,
      }}>
      <View style={styles.content}>
        <Text style={styles.message}>
          You have unsaved changes. Are you sure you want to discard them?
        </Text>
      </View>
    </ConfirmActionBottomSheet>
  );
});

const createStyles = (theme: any) =>
  StyleSheet.create({
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

export default DiscardChangesBottomSheet;
