import {Animated, Platform} from 'react-native';
import type {TextStyle} from 'react-native';

export interface FloatingLabelConfig {
  animatedValue: Animated.Value;
  theme: any;
  hasValue: boolean;
}

export const getFloatingLabelAnimatedStyle = ({
  animatedValue,
  theme,
}: Omit<FloatingLabelConfig, 'hasValue'>) => {
  const baseStyle: any = {
    position: 'absolute' as const,
    left: 20,
    fontSize: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [16, 12],
    }),
    top: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [
        Platform.OS === 'ios' ? 18 : 15,
        Platform.OS === 'ios' ? -6 : -10,
      ],
    }),
    color: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [
        theme.colors.textSecondary,
        theme.colors.textSecondary,
      ],
    }),
    backgroundColor: theme.colors.surface || theme.colors.background,
    paddingHorizontal: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 4],
    }),
    zIndex: 1,
  };

  if (Platform.OS === 'ios') {
    return {
      ...baseStyle,
      includeFontPadding: false,
      textAlignVertical: 'center' as const,
    };
  }

  return baseStyle;
};

export const getInputContainerBaseStyle = (theme: any, error?: string) => ({
  borderWidth: 2,
  borderColor: error ? theme.colors.error : theme.colors.border,
  borderRadius: 15,
  backgroundColor: theme.colors.surface,
  paddingHorizontal: 20,
  minHeight: 56,
  position: 'relative' as const,
  justifyContent: 'center' as const,
});

export const getValueTextStyle = (theme: any, hasValue: boolean): TextStyle => ({
  ...(hasValue ? theme.typography.inputFilled : theme.typography.input),
  color: hasValue ? theme.colors.text : theme.colors.textSecondary,
  fontSize: 16,
  lineHeight: 20,
  flex: 1,
  ...(Platform.OS === 'ios'
    ? {
        paddingTop: hasValue ? 10 : 12,
        paddingBottom: hasValue ? 8 : 12,
      }
    : {
        paddingTop: hasValue ? 10 : 8,
        paddingBottom: 8,
        textAlignVertical: 'center' as const,
      }),
  paddingHorizontal: 0,
  margin: 0,
  minHeight: Platform.OS === 'ios' ? 20 : 24,
});
