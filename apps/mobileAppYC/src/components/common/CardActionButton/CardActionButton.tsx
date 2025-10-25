import React, { useMemo } from 'react';
import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '@/hooks';

export type CardActionButtonVariant = 'primary' | 'success' | 'secondary';

export interface CardActionButtonProps {
  label: string;
  icon?: ImageSourcePropType;
  onPress: () => void;
  variant?: CardActionButtonVariant;
  buttonStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  iconStyle?: StyleProp<any>;
}

/**
 * Reusable action button component for card actions.
 * Eliminates duplication of button styling across BaseCard, TaskCard, ExpenseCard, and DocumentCard.
 */
export const CardActionButton: React.FC<CardActionButtonProps> = ({
  label,
  icon,
  onPress,
  variant = 'primary',
  buttonStyle,
  labelStyle,
  iconStyle,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, variant), [theme, variant]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.button, buttonStyle]}
      onPress={onPress}
    >
      {icon && (
        <Image
          source={icon}
          style={[styles.icon, iconStyle]}
        />
      )}
      <Text style={[styles.label, labelStyle]}>{label}</Text>
    </TouchableOpacity>
  );
};

const createStyles = (theme: any, variant: CardActionButtonVariant) => {
  const baseButton = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    marginTop: theme.spacing[3],
    gap: theme.spacing[2],
    minHeight: 45,
  };

  const variantStyles = {
    primary: {
      borderWidth: 1,
      borderColor: theme.colors.secondary,
      backgroundColor: theme.colors.white,
    },
    success: {
      borderWidth: 0,
      backgroundColor: theme.colors.success,
    },
    secondary: {
      borderWidth: 1,
      borderColor: theme.colors.borderMuted,
      backgroundColor: theme.colors.surface,
    },
  };

  return StyleSheet.create({
    button: {
      ...baseButton,
      ...variantStyles[variant],
    } as ViewStyle,
    icon: {
      width: 20,
      height: 20,
      resizeMode: 'contain' as const,
      tintColor: variant === 'success' ? theme.colors.white : theme.colors.secondary,
    },
    label: {
      ...theme.typography.button,
      color: variant === 'success' ? theme.colors.white : theme.colors.secondary,
    },
  });
};
