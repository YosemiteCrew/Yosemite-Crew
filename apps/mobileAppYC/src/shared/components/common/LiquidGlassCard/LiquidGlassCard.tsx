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
import {useTheme} from '@/hooks';

const LIGHT_CARD_TINT = 'rgba(255, 255, 255, 0.65)';
const DARK_CARD_TINT = 'rgba(28, 28, 30, 0.55)';

interface LiquidGlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glassEffect?: 'clear' | 'regular' | 'none';
  interactive?: boolean;
  tintColor?: string;
  colorScheme?: 'light' | 'dark' | 'system';
  padding?: keyof typeof import('@/theme').spacing;
  borderRadius?: keyof typeof import('@/theme').borderRadius;
  shadow?: keyof typeof import('@/theme').shadows;
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
  const {theme, isDark} = useTheme();

  const resolvedTintColor = React.useMemo(() => {
    if (tintColor) {
      return tintColor;
    }
    return isDark ? DARK_CARD_TINT : LIGHT_CARD_TINT;
  }, [isDark, tintColor]);

  const resolvedColorScheme = React.useMemo(() => {
    if (colorScheme !== 'system') {
      return colorScheme;
    }
    return isDark ? 'dark' : 'light';
  }, [colorScheme, isDark]);

  const baseStyle: ViewStyle = {
    padding: theme.spacing[padding],
    borderRadius: theme.borderRadius[borderRadius],
    ...theme.shadows[shadow],
    backgroundColor: isDark ? 'rgba(28, 28, 30, 0.72)' : 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
  };

  const isIosGlass = Platform.OS === 'ios' && isLiquidGlassSupported;

  // iOS glass style (LiquidGlass)
  const iosGlassStyle = StyleSheet.flatten([
    baseStyle,
    style,
  ]);

  // Android / fallback style
  const androidFallbackStyle = StyleSheet.flatten([
    baseStyle,
    {
      backgroundColor: isDark ? 'rgba(24, 24, 26, 0.85)' : 'rgba(255,255,255,0.95)',
    },
    fallbackStyle,
    style,
  ]);

  if (isIosGlass) {
    return (
      <LiquidGlassView
        style={iosGlassStyle}
        interactive={interactive}
        effect={glassEffect}
        tintColor={resolvedTintColor}
        colorScheme={resolvedColorScheme}>
        {children}
      </LiquidGlassView>
    );
  }

  return <View style={androidFallbackStyle}>{children}</View>;
};
