import React from 'react';
import {View} from 'react-native';
import LiquidGlassButton from '@/components/common/LiquidGlassButton/LiquidGlassButton';

interface TaskFormFooterProps {
  loading: boolean;
  disabled?: boolean;
  onSave: () => void;
  saveButtonText?: string;
  styles: any;
  theme: any;
}

export const TaskFormFooter: React.FC<TaskFormFooterProps> = ({
  loading,
  disabled,
  onSave,
  saveButtonText = 'Save',
  styles,
  theme,
}) => {
  return (
    <View style={styles.footer}>
      <LiquidGlassButton
        title={loading ? 'Saving...' : saveButtonText}
        onPress={onSave}
        loading={loading}
        disabled={disabled}
        style={styles.saveButton}
        textStyle={styles.saveButtonText}
        tintColor={theme.colors.secondary}
        forceBorder
        borderColor={theme.colors.borderMuted}
        shadowIntensity="medium"
        height={56}
        borderRadius={16}
      />
    </View>
  );
};
