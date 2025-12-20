import React, { useMemo } from 'react';
import LiquidGlassButton from '@/shared/components/common/LiquidGlassButton/LiquidGlassButton';
import { useTheme } from '@/hooks';
import { StyleSheet, StyleProp, TextStyle, ViewStyle } from 'react-native';

export interface PrimaryActionButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  loading?: boolean;
}

export const PrimaryActionButton: React.FC<PrimaryActionButtonProps> = ({
  title,
  onPress,
  disabled,
  style,
  textStyle,
  loading,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <LiquidGlassButton
      title={title}
      onPress={onPress}
      disabled={disabled}
      glassEffect="clear"
      interactive
      borderRadius="lg"
      forceBorder
      borderColor={theme.colors.borderMuted}
      height={56}
      loading={loading}
      style={[styles.button, style]}
      textStyle={[styles.buttonText, textStyle]}
      tintColor={theme.colors.secondary}
      shadowIntensity="medium"
    />
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    button: {
      width: '100%',
      backgroundColor: theme.colors.secondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      ...theme.shadows.md,
    },
    buttonText: {
      ...theme.typography.cta,
      color: theme.colors.background,
      textAlign: 'center',
    },
  });

export default PrimaryActionButton;
