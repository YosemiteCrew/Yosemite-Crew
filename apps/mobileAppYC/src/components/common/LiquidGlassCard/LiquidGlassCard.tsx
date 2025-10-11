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
  };

  const flattenedStyle = StyleSheet.flatten([
    baseStyle,
    fallbackStyle,
    style,
  ]);

  const isIosGlass = Platform.OS === 'ios' && isLiquidGlassSupported;

  if (isIosGlass) {
    return (
      <LiquidGlassView
        style={flattenedStyle}
        interactive={interactive}
        effect={glassEffect}
        tintColor={tintColor ?? 'light'}
        colorScheme={colorScheme}>
        {children}
      </LiquidGlassView>
    );
  }

  return <View style={flattenedStyle}>{children}</View>;
};
