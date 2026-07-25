import React, {useMemo} from 'react';
import {
  StyleSheet,
  StyleProp,
  TextStyle,
  ViewStyle,
  Text,
  ActivityIndicator,
} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import type {Theme} from '@/theme';

export interface PrimaryActionButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  loading?: boolean;
}

/**
 * The primary call-to-action: a full-width, flat espresso button (warm-bone
 * design system) — height 56, radius 18, `cta` fill, `cta` shadow lift, no
 * border. Not a glass surface; the design uses solid CTAs.
 */
export const PrimaryActionButton: React.FC<PrimaryActionButtonProps> = ({
  title,
  onPress,
  disabled,
  style,
  textStyle,
  loading,
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isDisabled = disabled || loading;

  return (
    <PressableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{disabled: !!isDisabled, busy: !!loading}}
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.button, isDisabled && styles.buttonDisabled, style]}>
      {loading ? (
        <ActivityIndicator color={theme.colors.ctaText} />
      ) : (
        <Text style={[styles.buttonText, textStyle]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </PressableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      width: '100%',
      height: 56,
      borderRadius: theme.borderRadius.button,
      backgroundColor: theme.colors.cta,
      alignItems: 'center',
      justifyContent: 'center',
      ...theme.shadows.cta,
    },
    buttonDisabled: {
      backgroundColor: theme.colors.divider,
      boxShadow: 'none',
    },
    buttonText: {
      ...theme.typography.cta,
      color: theme.colors.ctaText,
      textAlign: 'center',
    },
  });

export default PrimaryActionButton;
