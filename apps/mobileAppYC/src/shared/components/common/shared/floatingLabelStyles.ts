import {Platform} from 'react-native';
import type {TextStyle} from 'react-native';
import {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import type {Theme} from '@/theme/themes';

export interface FloatingLabelConfig {
  animatedValue: SharedValue<number>;
  theme: Theme;
  hasValue: boolean;
  focused?: boolean;
  placeholderOffset?: number;
}

export const useFloatingLabelAnimatedStyle = ({
  animatedValue,
  theme,
  focused = false,
  placeholderOffset = 0,
}: Omit<FloatingLabelConfig, 'hasValue'>) => {
  // Calculate exact positioning to match Input component
  const placeholderLineHeight =
    theme.typography.input.lineHeight ?? theme.typography.input.fontSize ?? 16;
  const placeholderTop = (theme.spacing['14'] - placeholderLineHeight) / 2 - 2;
  const labelLineHeight =
    theme.typography.inputLabel.lineHeight ??
    theme.typography.inputLabel.fontSize ??
    12;
  const floatingTop = -Math.round(labelLineHeight / 2) - 2;

  const activeColor = focused
    ? theme.colors.primary
    : theme.colors.textSecondary;
  const isIOS = Platform.OS === 'ios';

  return useAnimatedStyle(() => {
    const baseStyle: any = {
      position: 'absolute',
      left: interpolate(
        animatedValue.value,
        [0, 1],
        [theme.spacing['5'] + placeholderOffset, theme.spacing['5']],
      ),
      fontFamily: theme.typography.input.fontFamily,
      fontWeight: theme.typography.input.fontWeight,
      fontSize: interpolate(
        animatedValue.value,
        [0, 1],
        [
          theme.typography.input.fontSize ?? 16,
          theme.typography.inputLabel.fontSize ?? 12,
        ],
      ),
      top: interpolate(
        animatedValue.value,
        [0, 1],
        [placeholderTop, floatingTop],
      ),
      color: interpolateColor(
        animatedValue.value,
        [0, 1],
        [theme.colors.textSecondary, activeColor],
      ),
      letterSpacing: theme.typography.inputLabel.letterSpacing,
      backgroundColor: theme.colors.surface || theme.colors.background,
      paddingHorizontal: interpolate(
        animatedValue.value,
        [0, 1],
        [0, theme.spacing['1']],
      ),
      paddingVertical: interpolate(animatedValue.value, [0, 1], [1, 0]),
      zIndex: 1,
      pointerEvents: 'none',
    };

    if (isIOS) {
      return {
        ...baseStyle,
        includeFontPadding: false,
        textAlignVertical: 'center',
      };
    }

    return baseStyle;
  }, [activeColor, isIOS, placeholderOffset, theme]);
};

export const getInputContainerBaseStyle = (theme: Theme, error?: string) => ({
  borderWidth: 1,
  borderColor: error ? theme.colors.error : theme.colors.border,
  borderRadius: theme.borderRadius.lg,
  backgroundColor: theme.colors.surface,
  paddingHorizontal: theme.spacing['5'],
  minHeight: theme.spacing['14'],
  position: 'relative' as const,
  justifyContent: 'center' as const,
});

export const getValueTextStyle = (
  theme: Theme,
  hasValue: boolean,
): TextStyle => ({
  ...(hasValue ? theme.typography.inputFilled : theme.typography.input),
  color: hasValue ? theme.colors.text : theme.colors.textSecondary,
  fontSize: theme.typography.input.fontSize,
  lineHeight: theme.spacing['5'],
  flex: 1,
  ...(Platform.OS === 'ios'
    ? {
        paddingTop: hasValue ? theme.spacing['2.5'] : theme.spacing['3'],
        paddingBottom: hasValue ? theme.spacing['2'] : theme.spacing['3'],
      }
    : {
        paddingTop: hasValue ? theme.spacing['2.5'] : theme.spacing['2'],
        paddingBottom: theme.spacing['2'],
        textAlignVertical: 'center' as const,
      }),
  paddingHorizontal: 0,
  margin: 0,
  minHeight: Platform.OS === 'ios' ? theme.spacing['5'] : theme.spacing['6'],
});
