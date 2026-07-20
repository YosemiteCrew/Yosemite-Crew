import React from 'react';
import {
  Text,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  StyleProp,
} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'dangerGhost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
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

  // Warm-bone rule: primary is always the dark CTA fill (never blue);
  // secondary is a bordered transparent button; outline/ghost read as links.
  const indicatorColorByVariant: Record<ButtonVariant, string> = {
    primary: theme.colors.ctaText,
    secondary: theme.colors.inkBody,
    outline: theme.colors.blue,
    ghost: theme.colors.blue,
    danger: theme.colors.white,
    dangerGhost: theme.colors.danger,
  };

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: theme.borderRadius.button,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
    };

    const sizeStyles: Record<string, ViewStyle> = {
      small: {
        paddingHorizontal: theme.spacing['4'],
        paddingVertical: theme.spacing['2'],
        minHeight: 40,
      },
      medium: {
        paddingHorizontal: theme.spacing['5'],
        paddingVertical: theme.spacing['3'],
        minHeight: 48,
      },
      large: {
        paddingHorizontal: theme.spacing['6'],
        paddingVertical: theme.spacing['4'],
        minHeight: 54,
      },
    };

    const variantStyles: Record<ButtonVariant, ViewStyle> = {
      primary: {
        backgroundColor: disabled ? theme.colors.divider : theme.colors.cta,
        ...(disabled ? {} : theme.shadows.cta),
      },
      secondary: {
        backgroundColor: theme.colors.transparent,
        borderWidth: 1,
        borderColor: disabled ? theme.colors.hairline : theme.colors.divider,
      },
      outline: {
        backgroundColor: theme.colors.transparent,
        borderWidth: 1,
        borderColor: disabled ? theme.colors.hairline : theme.colors.blue,
      },
      ghost: {
        backgroundColor: theme.colors.transparent,
      },
      danger: {
        backgroundColor: disabled ? theme.colors.divider : theme.colors.danger,
      },
      dangerGhost: {
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
      ...(size === 'small'
        ? theme.typography.buttonSmall
        : theme.typography.button),
    };

    const variantStyles: Record<ButtonVariant, TextStyle> = {
      primary: {color: theme.colors.ctaText},
      secondary: {
        color: disabled ? theme.colors.inkFaint : theme.colors.inkBody,
      },
      outline: {color: disabled ? theme.colors.inkFaint : theme.colors.blue},
      ghost: {color: disabled ? theme.colors.inkFaint : theme.colors.blue},
      danger: {color: theme.colors.white},
      dangerGhost: {
        color: disabled ? theme.colors.inkFaint : theme.colors.danger,
      },
    };

    return {
      ...baseStyle,
      ...variantStyles[variant],
    };
  };

  return (
    <PressableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}>
      {loading && (
        <ActivityIndicator
          size="small"
          color={indicatorColorByVariant[variant]}
          style={{marginRight: theme.spacing['2']}}
        />
      )}
      <Text style={[getTextStyle(), textStyle]}>{title}</Text>
    </PressableOpacity>
  );
};
