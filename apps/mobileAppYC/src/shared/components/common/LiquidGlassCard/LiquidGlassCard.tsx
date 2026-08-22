import React from 'react';
import {Platform, StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {LiquidGlassView, isLiquidGlassSupported} from '@callstack/liquid-glass';
import {BlurView} from '@react-native-community/blur';
import {useTheme} from '@/hooks';
import {UI_FEATURE_FLAGS} from '@/config/variables';

import {colors} from '@/theme';
// Flip to true to force a consistent outline everywhere.
const FORCE_CARD_BORDER = UI_FEATURE_FLAGS.forceLiquidGlassBorder;
// Warm-bone hairline (light value of theme.colors.hairline); this module-level
// forced outline cannot read useTheme(), so it mirrors the token literal.
const FORCED_BORDER_COLOR = colors.hairline;
const FORCED_BORDER_WIDTH = 1;
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
  const {theme} = useTheme();
  const resolvedColorScheme = React.useMemo(() => {
    if (colorScheme === 'system') {
      return 'light';
    }
    return colorScheme;
  }, [colorScheme]);

  const baseStyle: ViewStyle = {
    padding: theme.spacing[padding],
    borderRadius: theme.borderRadius[borderRadius],
    ...theme.shadows[shadow],
  };

  const baseStyleWithoutShadow: ViewStyle = {
    padding: theme.spacing[padding],
    borderRadius: theme.borderRadius[borderRadius],
  };

  const mergedStyleOverrides = React.useMemo(
    () => StyleSheet.flatten([fallbackStyle, style]),
    [fallbackStyle, style],
  ) as ViewStyle | undefined;

  // A caller-supplied solid fill (a coloured card) opts out of frosted glass.
  const explicitFill =
    (mergedStyleOverrides?.backgroundColor as string | undefined) ?? tintColor;

  const overlayBorderColor = FORCE_CARD_BORDER
    ? FORCED_BORDER_COLOR
    : ((mergedStyleOverrides?.borderColor as string | undefined) ??
      theme.colors.hairline);
  const overlayBorderWidth = FORCE_CARD_BORDER
    ? FORCED_BORDER_WIDTH
    : (mergedStyleOverrides?.borderWidth ?? 1);

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

  // iOS 26: genuine liquid glass, warm-tinted.
  const useNativeGlass =
    Platform.OS === 'ios' &&
    isLiquidGlassSupported &&
    !LOCK_IOS_GLASS_APPEARANCE &&
    glassEffect !== 'none';

  if (useNativeGlass) {
    const iosGlassStyle = StyleSheet.flatten([
      baseStyleWithoutShadow,
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
        tintColor={tintColor ?? theme.colors.glassSurface}
        colorScheme={resolvedColorScheme}>
        {children}
      </LiquidGlassView>
    );
  }

  // Android: real frosted blur + warm tint for default cards (luxurious yet
  // readable). Coloured / opted-out cards render as a solid warm surface.
  const useAndroidGlass =
    Platform.OS === 'android' && glassEffect !== 'none' && !explicitFill;

  if (useAndroidGlass) {
    const glassContainerStyle = StyleSheet.flatten([
      baseStyle,
      overlayShapeStyle,
      {
        borderColor: overlayBorderColor,
        borderWidth: overlayBorderWidth,
        overflow: 'hidden' as const,
        backgroundColor: 'transparent',
      },
      fallbackStyle,
      style,
    ]);

    return (
      <View style={glassContainerStyle}>
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType={resolvedColorScheme === 'dark' ? 'dark' : 'light'}
          blurAmount={14}
          reducedTransparencyFallbackColor={theme.colors.screen2}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {backgroundColor: theme.colors.glassSurfaceStrong},
          ]}
        />
        {children}
      </View>
    );
  }

  const fallbackViewStyle = StyleSheet.flatten([
    baseStyle,
    overlayShapeStyle,
    {
      backgroundColor: explicitFill ?? theme.colors.screen2,
      borderColor: overlayBorderColor,
      borderWidth: overlayBorderWidth,
    },
    fallbackStyle,
    style,
  ]);

  return <View style={fallbackViewStyle}>{children}</View>;
};
