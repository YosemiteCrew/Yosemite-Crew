import React from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import {useTheme} from '../../../hooks';

interface LiquidGlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glassEffect?: 'clear' | 'regular' | 'none';
  interactive?: boolean;
  tintColor?: string;
  colorScheme?: 'light' | 'dark' | 'system';
  padding?: keyof typeof import('../../../theme').spacing;
  borderRadius?: keyof typeof import('../../../theme').borderRadius;
  shadow?: keyof typeof import('../../../theme').shadows;
  fallbackStyle?: StyleProp<ViewStyle>;
}

export const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  style,
  glassEffect = 'regular',
  interactive = false,
  tintColor,
  colorScheme = 'light',
  padding = '4',
  borderRadius = 'lg',
  shadow = 'base',
  fallbackStyle,
}) => {
  const {theme} = useTheme();

  const baseStyle: ViewStyle = {
    padding: theme.spacing[padding],
    borderRadius: theme.borderRadius[borderRadius],
    ...theme.shadows[shadow],
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    overflow: 'hidden',
  };

  const isIosGlass = Platform.OS === 'ios' && isLiquidGlassSupported;

  // 1. Calculate the style for the LiquidGlassView (iOS)
  const iosGlassStyle = StyleSheet.flatten([
    baseStyle,
    style,
    // NOTE: fallbackStyle is deliberately excluded here.
  ]);

  // 2. Calculate the style for the plain View (Android/Fallback)
  const androidFallbackStyle = StyleSheet.flatten([
    baseStyle,
    fallbackStyle, // Only applied when LiquidGlass is not used.
    style,
  ]);


  if (isIosGlass) {
    return (
      <LiquidGlassView
        style={iosGlassStyle}
        interactive={interactive}
        effect={glassEffect}
        tintColor={tintColor ?? 'light'}
        colorScheme={colorScheme}>
        {children}
      </LiquidGlassView>
    );
  }

  // Use the Android/Fallback style
  return <View style={androidFallbackStyle}>{children}</View>;
};