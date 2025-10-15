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

  // ✅ Stable, neutral tint to avoid random primary color hues
  const resolvedTintColor = tintColor ?? 'rgba(255,255,255,0.6)';

  const baseStyle: ViewStyle = {
    padding: theme.spacing[padding],
    borderRadius: theme.borderRadius[borderRadius],
    ...theme.shadows[shadow],
    backgroundColor: 'rgba(255,255,255,0.9)', // ✅ prevents blue tint reflection
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
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
      backgroundColor: 'rgba(255,255,255,0.95)', // ✅ clean white fallback
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
        colorScheme={colorScheme}>
        {children}
      </LiquidGlassView>
    );
  }

  return <View style={androidFallbackStyle}>{children}</View>;
};
