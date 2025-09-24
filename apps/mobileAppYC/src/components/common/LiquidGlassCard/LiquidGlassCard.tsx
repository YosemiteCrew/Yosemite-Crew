import React from 'react';
import {
  View,
  ViewStyle,
  Platform,
} from 'react-native';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import {useTheme} from '../../../hooks';

interface LiquidGlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  glassEffect?: 'clear' | 'regular' | 'none';
  interactive?: boolean;
  tintColor?: string;
  colorScheme?: 'light' | 'dark' | 'system';
  padding?: keyof typeof import('../../../theme').spacing;
  borderRadius?: keyof typeof import('../../../theme').borderRadius;
  shadow?: keyof typeof import('../../../theme').shadows;
  fallbackStyle?: ViewStyle;
}

export const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  style,
  glassEffect = 'regular',
  interactive = false,
  tintColor,
  colorScheme = 'system',
  padding = '4',
  borderRadius = 'lg',
  shadow = 'base',
  fallbackStyle,
}) => {
  const {theme} = useTheme();

  const getCardStyle = (): ViewStyle => ({
    padding: theme.spacing[padding],
    borderRadius: theme.borderRadius[borderRadius],
    ...theme.shadows[shadow],
  });

  const getFallbackStyle = (): ViewStyle => ({
    backgroundColor: colorScheme === 'dark'
      ? 'rgba(255, 255, 255, 0.1)' 
      : 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: colorScheme === 'dark' 
      ? 'rgba(255, 255, 255, 0.2)' 
      : 'rgba(255, 255, 255, 0.3)',
    ...theme.shadows.base,
    ...fallbackStyle,
  });

  const cardStyle = getCardStyle();

  // If liquid glass is supported on iOS
  if (Platform.OS === 'ios' && isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        style={[cardStyle, style]}
        interactive={interactive}
        effect={glassEffect}
        tintColor={tintColor}
        colorScheme={colorScheme}>
        {children}
      </LiquidGlassView>
    );
  }

  // Fallback for Android or unsupported iOS versions
  return (
    <View style={[cardStyle, getFallbackStyle(), style]}>
      {children}
    </View>
  );
};