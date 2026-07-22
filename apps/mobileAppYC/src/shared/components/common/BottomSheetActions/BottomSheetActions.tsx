import React from 'react';
import {View, StyleSheet} from 'react-native';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';

interface BottomSheetActionsProps {
  onCancel: () => void;
  onSave: () => void;
  theme: any;
  cancelTintColor: string;
  cancelTextColor?: string;
}

export const BottomSheetActions: React.FC<BottomSheetActionsProps> = ({
  onCancel,
  onSave,
  theme,
  cancelTintColor,
  cancelTextColor,
}) => {
  const styles = createStyles(theme, cancelTextColor ?? theme.colors.secondary);
  return (
    <View style={styles.buttonContainer}>
      <LiquidGlassButton
        title="Cancel"
        onPress={onCancel}
        style={styles.cancelButton}
        textStyle={styles.cancelButtonText}
        tintColor={cancelTintColor}
        shadowIntensity="light"
        forceBorder
        borderColor={theme.colors.borderMuted}
        height={theme.spacing['14']}
        borderRadius={theme.borderRadius.lg}
      />
      <LiquidGlassButton
        title="Save"
        onPress={onSave}
        style={styles.saveButton}
        textStyle={styles.saveButtonText}
        tintColor={theme.colors.secondary}
        shadowIntensity="medium"
        forceBorder
        borderColor={theme.colors.borderMuted}
        height={theme.spacing['14']}
        borderRadius={theme.borderRadius.lg}
      />
    </View>
  );
};

const createStyles = (theme: any, cancelTextColor: string) =>
  StyleSheet.create({
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['4'],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    cancelButtonText: {
      ...theme.typography.paragraphBold,
      color: cancelTextColor,
    },
    saveButton: {
      flex: 1,
    },
    saveButtonText: {
      ...theme.typography.paragraphBold,
      color: theme.colors.ctaText,
    },
  });
