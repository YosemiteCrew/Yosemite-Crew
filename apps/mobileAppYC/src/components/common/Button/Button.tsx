import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import {useTheme} from '../../../hooks';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const {theme} = useTheme();

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: theme.borderRadius.base,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
    };

    // Size styles
    const sizeStyles: Record<string, ViewStyle> = {
      small: {
        paddingHorizontal: theme.spacing['3'],
        paddingVertical: theme.spacing['2'],
        minHeight: 36,
      },
      medium: {
        paddingHorizontal: theme.spacing['4'],
        paddingVertical: theme.spacing['3'],
        minHeight: 44,
      },
      large: {
        paddingHorizontal: theme.spacing['6'],
        paddingVertical: theme.spacing['4'],
        minHeight: 52,
      },
    };

    // Variant styles
    const variantStyles: Record<string, ViewStyle> = {
      primary: {
        backgroundColor: disabled
          ? theme.colors.textSecondary
          : theme.colors.primary,
      },
      secondary: {
        backgroundColor: disabled
          ? theme.colors.textSecondary
          : theme.colors.secondary,
      },
      outline: {
        backgroundColor: theme.colors.transparent,
        borderWidth: 1,
        borderColor: disabled ? theme.colors.textSecondary : theme.colors.primary,
      },
      ghost: {
        backgroundColor: theme.colors.transparent,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      ...(size === 'small' ? theme.typography.buttonSmall : theme.typography.button),
    };

    const variantStyles: Record<string, TextStyle> = {
      primary: {
        color: theme.colors.surface,
      },
      secondary: {
        color: theme.colors.surface,
      },
      outline: {
        color: disabled ? theme.colors.textSecondary : theme.colors.primary,
      },
      ghost: {
        color: disabled ? theme.colors.textSecondary : theme.colors.primary,
      },
    };

    return {
      ...baseStyle,
      ...variantStyles[variant],
    };
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}>
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'secondary' ? theme.colors.surface : theme.colors.primary}
          style={{marginRight: theme.spacing['2']}}
        />
      )}
      <Text style={[getTextStyle(), textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};