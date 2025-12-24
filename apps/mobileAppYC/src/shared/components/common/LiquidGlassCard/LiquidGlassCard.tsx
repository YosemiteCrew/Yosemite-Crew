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
// Set to true to fall back to static styling on iOS if native glass misbehaves.
const LOCK_IOS_GLASS_APPEARANCE = false;

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
  const resolvedColorScheme = React.useMemo(() => {
    if (colorScheme === 'system') {
      return 'light';
    }
    return colorScheme;
  }, [colorScheme]);

  const resolvedTintColor = React.useMemo(() => {
    if (tintColor) {
      return tintColor;
    }
    return resolvedColorScheme === 'dark' ? DARK_CARD_TINT : LIGHT_CARD_TINT;
  }, [resolvedColorScheme, tintColor]);

  const defaultBackgroundColor = isDark
    ? 'rgba(28, 28, 30, 0.72)'
    : 'rgba(255,255,255,0.9)';
  const defaultBorderColor = isDark
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(0,0,0,0.05)';
  const defaultBorderWidth = 1;

  const baseStyle: ViewStyle = {
    padding: theme.spacing[padding],
    borderRadius: theme.borderRadius[borderRadius],
    ...theme.shadows[shadow],
    overflow: 'hidden',
  };

  const mergedStyleOverrides = React.useMemo(
    () => StyleSheet.flatten([fallbackStyle, style]),
    [fallbackStyle, style],
  ) as ViewStyle | undefined;

  const overlayBackgroundColor =
    (mergedStyleOverrides?.backgroundColor as string | undefined) ??
    tintColor ??
    resolvedTintColor ??
    defaultBackgroundColor;
  const overlayBorderColor =
    (mergedStyleOverrides?.borderColor as string | undefined) ??
    defaultBorderColor;
  const overlayBorderWidth =
    mergedStyleOverrides?.borderWidth ?? defaultBorderWidth;

  const overlayShapeStyle = React.useMemo(() => {
    const shape: ViewStyle = {};
    const baseRadius =
      typeof mergedStyleOverrides?.borderRadius === 'number'
        ? mergedStyleOverrides.borderRadius
        : theme.borderRadius[borderRadius];

    if (typeof baseRadius === 'number') {
      shape.borderRadius = baseRadius;
    }

    const radiusKeys = [
      'borderTopLeftRadius',
      'borderTopRightRadius',
      'borderBottomLeftRadius',
      'borderBottomRightRadius',
    ] as const;
    for (const key of radiusKeys) {
      const value = mergedStyleOverrides?.[key];
      if (typeof value === 'number') {
        shape[key] = value;
      }
    }

    return shape;
  }, [borderRadius, mergedStyleOverrides, theme.borderRadius]);

  const fallbackViewStyle = StyleSheet.flatten([
    baseStyle,
    overlayShapeStyle,
    {
      backgroundColor: overlayBackgroundColor,
      borderColor: overlayBorderColor,
      borderWidth: overlayBorderWidth,
    },
    fallbackStyle,
    style,
  ]);

  const useNativeGlass =
    Platform.OS === 'ios' && isLiquidGlassSupported && !LOCK_IOS_GLASS_APPEARANCE;

  if (useNativeGlass) {
    const iosGlassStyle = StyleSheet.flatten([
      baseStyle,
      overlayShapeStyle,
      fallbackStyle,
      style,
      {
        backgroundColor: 'transparent',
        borderColor: overlayBorderColor,
        borderWidth: overlayBorderWidth,
      },
    ]);

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

  return <View style={fallbackViewStyle}>{children}</View>;
};
