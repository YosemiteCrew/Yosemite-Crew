/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  StyleProp,
  ActivityIndicator,
  PlatformColor,
  Platform,
  DimensionValue,
  View,
  StyleSheet,
} from 'react-native';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import {useTheme} from '@/hooks';

const LIGHT_GLASS_TINT = 'rgba(255, 255, 255, 0.65)';
const DARK_GLASS_TINT = 'rgba(28, 28, 30, 0.55)';
// Set to true to fall back to static styling on iOS if native glass misbehaves.
const LOCK_IOS_GLASS_APPEARANCE = false;

const WHITE_COLOR_ALIASES = [
  '#ffffff',
  '#fff',
  'white',
  'rgba(255,255,255,1)',
  'rgba(255, 255, 255, 1)',
] as const;

const resolveBorderRadius = (
  radius: GlassButtonProps['borderRadius'],
  themeRadius: Record<string, number>,
  fallback: number,
) => {
  if (typeof radius === 'number') {
    return radius;
  }

  if (typeof radius === 'string') {
    const value = themeRadius[radius];
    if (typeof value === 'number') {
      return value;
    }
  }

  return fallback;
};

const isWhiteOrLightColor = (color?: string): boolean => {
  if (!color) {
    return false;
  }

  const normalized = color.toLowerCase().replaceAll(/\s/g, '');
  if (WHITE_COLOR_ALIASES.includes(normalized as typeof WHITE_COLOR_ALIASES[number])) {
    return true;
  }

  // Handle rgba() strings
  if (normalized.startsWith('rgba(')) {
    try {
      const parts = normalized
        .replace('rgba(', '')
        .replace(')', '')
        .split(',')
        .map(Number);
      const [r, g, b] = parts;
      if ([r, g, b].some(v => Number.isNaN(v))) return false;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return lum > 0.9;
    } catch {
      return false;
    }
  }

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length >= 6) {
      const r = Number.parseInt(hex.substring(0, 2), 16);
      const g = Number.parseInt(hex.substring(2, 4), 16);
      const b = Number.parseInt(hex.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.9;
    }
  }

  return false;
};

const buildShadowStyle = (intensity: GlassButtonProps['shadowIntensity'], themeShadows: any) => {
  if (!intensity || intensity === 'none') {
    return themeShadows.none;
  }

  const shadowMap = {
    light: themeShadows.xs,
    medium: themeShadows.sm,
    strong: themeShadows.md,
  } as const;

  return shadowMap[intensity];
};

const SIZE_CONFIG = {
  small: {paddingHorizontalKey: '3', paddingVerticalKey: '2', fallbackHeight: 36},
  medium: {paddingHorizontalKey: '4', paddingVerticalKey: '3', fallbackHeight: 44},
  large: {paddingHorizontalKey: '6', paddingVerticalKey: '4', fallbackHeight: 52},
} as const;

const buildSizeStyle = (
  size: NonNullable<GlassButtonProps['size']>,
  themeSpacing: Record<string, number>,
  buttonHeight: GlassButtonProps['height'],
  minHeight: GlassButtonProps['minHeight'],
): ViewStyle => {
  const config = SIZE_CONFIG[size];
  const resolvedMinHeight =
    (minHeight ?? buttonHeight ?? config.fallbackHeight) as number;

  return {
    paddingHorizontal: themeSpacing[config.paddingHorizontalKey],
    paddingVertical: themeSpacing[config.paddingVerticalKey],
    minHeight: resolvedMinHeight,
  } as ViewStyle;
};

const buildFallbackSurfaceStyle = ({
  tintColor,
  isDark,
  borderColor,
  isLightTint,
}: {
  tintColor?: string;
  isDark: boolean;
  borderColor?: string;
  isLightTint: boolean;
}): ViewStyle => {
  // For white-ish buttons, use pure white (not translucent)
  let backgroundColor: string;
  if (isWhiteOrLightColor(tintColor)) {
    backgroundColor = '#FFFFFF';
  } else if (tintColor) {
    backgroundColor = tintColor;
  } else {
    backgroundColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#FFFFFF';
  }

  let computedBorderColor = borderColor;

  if (!computedBorderColor) {
    if (tintColor) {
      computedBorderColor = isLightTint
        ? 'rgba(0, 0, 0, 0.15)'
        : `${tintColor}40`;
    } else {
      computedBorderColor = isDark
        ? 'rgba(255, 255, 255, 0.2)'
        : 'rgba(0, 0, 0, 0.1)';
    }
  }

  return {
    backgroundColor,
    borderWidth: 1,
    borderColor: computedBorderColor,
  };
};

const buildGlassSurfaceStyle = ({
  borderColor,
  isLightTint,
  forceBorder,
  shadowIntensity,
  themeShadows,
}: {
  borderColor?: string;
  isLightTint: boolean;
  forceBorder: boolean;
  shadowIntensity: GlassButtonProps['shadowIntensity'];
  themeShadows: any;
}): ViewStyle => {
  const shouldAddBorder = forceBorder || isLightTint;
  const borderColorValue =
    borderColor ??
    (isLightTint
      ? 'rgba(0, 0, 0, 0.15)'
      : 'rgba(255, 255, 255, 0.2)');

  return {
    borderWidth: shouldAddBorder ? 1 : 0.5,
    borderColor: borderColorValue,
    ...(shouldAddBorder ? buildShadowStyle(shadowIntensity, themeShadows) : {}),
  };
};

const resolvePlatformLabelColor = (
  isDark: boolean,
  themeColors: ReturnType<typeof useTheme>['theme']['colors'],
) => {
  if (typeof PlatformColor === 'function') {
    return PlatformColor('labelColor');
  }

  if (isDark) {
    return themeColors.white;
  }

  return themeColors.text;
};

const computeTextColor = ({
  disabled,
  tintColor,
  isDark,
  themeColors,
  useIosGlass,
}: {
  disabled: boolean;
  tintColor?: string;
  isDark: boolean;
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
  useIosGlass: boolean;
}) => {
  if (disabled) {
    return themeColors.textSecondary;
  }

  if (useIosGlass) {
    if (isWhiteOrLightColor(tintColor)) {
      return themeColors.text;
    }
    return resolvePlatformLabelColor(isDark, themeColors);
  }

  if (tintColor) {
    return isWhiteOrLightColor(tintColor) ? themeColors.text : themeColors.white;
  }

  return isDark ? themeColors.white : themeColors.text;
};

const computeLoadingColor = ({
  tintColor,
  isDark,
  themeColors,
  useIosGlass,
}: {
  tintColor?: string;
  isDark: boolean;
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
  useIosGlass: boolean;
}) => {
  if (useIosGlass) {
    if (isWhiteOrLightColor(tintColor)) {
      return themeColors.text;
    }
    return resolvePlatformLabelColor(isDark, themeColors);
  }

  if (tintColor) {
    return isWhiteOrLightColor(tintColor) ? themeColors.text : themeColors.white;
  }

  return isDark ? themeColors.white : themeColors.text;
};

interface GlassButtonProps {
  title?: string;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  compact?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  glassEffect?: 'clear' | 'regular' | 'none';
  interactive?: boolean;
  tintColor?: string;
  colorScheme?: 'light' | 'dark' | 'system';
  width?: DimensionValue;
  height?: DimensionValue;
  minWidth?: DimensionValue;
  minHeight?: DimensionValue;
  maxWidth?: DimensionValue;
  borderRadius?: number | keyof typeof import('@/theme').borderRadius;
  customContent?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  // Enhanced glass visibility props
  forceBorder?: boolean; // Force border even with dark colors
  borderColor?: string; // Custom border color
  shadowIntensity?: 'none' | 'light' | 'medium' | 'strong'; // Control shadow for visibility
}

export const LiquidGlassButton: React.FC<GlassButtonProps> = ({
  title,
  onPress,
  size = 'medium',
  compact = false,
  disabled = false,
  loading = false,
  style,
  textStyle,
  glassEffect = 'regular',
  interactive = true,
  tintColor,
  colorScheme = 'light',
  width,
  height,
  minWidth,
  minHeight,
  maxWidth,
  borderRadius,
  customContent,
  leftIcon,
  rightIcon,
  forceBorder = false,
  borderColor,
  shadowIntensity = 'light',
}) => {
  const {theme, isDark} = useTheme();
  const useNativeGlass =
    Platform.OS === 'ios' && isLiquidGlassSupported && !LOCK_IOS_GLASS_APPEARANCE;
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
    return resolvedColorScheme === 'dark' ? DARK_GLASS_TINT : LIGHT_GLASS_TINT;
  }, [resolvedColorScheme, tintColor]);
  const borderRadiusValue = React.useMemo(
    () =>
      resolveBorderRadius(
        borderRadius,
        theme.borderRadius,
        theme.borderRadius.base,
      ),
    [borderRadius, theme.borderRadius],
  );

  const baseButtonStyle = React.useMemo<ViewStyle>(
    () => ({
      borderRadius: borderRadiusValue,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      width,
      height,
      minWidth,
      maxWidth,
      overflow: 'hidden',
    }),
    [borderRadiusValue, height, maxWidth, minWidth, width],
  );

  const sizeStyle = React.useMemo(
    () => (compact ? {} : buildSizeStyle(size, theme.spacing, height, minHeight)),
    [compact, height, minHeight, size, theme.spacing],
  );

  const isLightTint = React.useMemo(
    () => isWhiteOrLightColor(resolvedTintColor),
    [resolvedTintColor],
  );

  const surfaceStyle = React.useMemo(() => {
    if (useNativeGlass) {
      return buildGlassSurfaceStyle({
        borderColor,
        isLightTint,
        forceBorder,
        shadowIntensity,
        themeShadows: theme.shadows,
      });
    }

    return buildFallbackSurfaceStyle({
      tintColor: resolvedTintColor,
      isDark,
      borderColor,
      isLightTint,
    });
  }, [
    borderColor,
    forceBorder,
    isLightTint,
    resolvedTintColor,
    shadowIntensity,
    useNativeGlass,
    isDark,
    theme.shadows,
  ]);

  const buttonStyle = React.useMemo(
    () => ({
      ...baseButtonStyle,
      ...sizeStyle,
      ...surfaceStyle,
    }),
    [baseButtonStyle, sizeStyle, surfaceStyle],
  );

  const flattenedStyle = React.useMemo(
    () => StyleSheet.flatten(style) as ViewStyle | undefined,
    [style],
  );

  const hasExplicitSize = React.useMemo(() => {
    return (
      typeof width === 'number' ||
      typeof height === 'number' ||
      typeof flattenedStyle?.width === 'number' ||
      typeof flattenedStyle?.height === 'number'
    );
  }, [flattenedStyle?.height, flattenedStyle?.width, height, width]);

  const textColor = React.useMemo(
    () =>
      computeTextColor({
        disabled,
        tintColor: resolvedTintColor,
        isDark,
        themeColors: theme.colors,
        useIosGlass: useNativeGlass,
      }),
    [disabled, resolvedTintColor, isDark, theme.colors, useNativeGlass],
  );

  const buttonTextStyle = React.useMemo<TextStyle>(
    () => {
      const typography =
        size === 'small'
          ? theme.typography.buttonSmall
          : theme.typography.button;

      return {
        ...typography,
        color: textColor,
      };
    },
    [size, textColor, theme.typography],
  );

  const loadingColor = React.useMemo(
    () =>
      computeLoadingColor({
        tintColor: resolvedTintColor,
        isDark,
        themeColors: theme.colors,
        useIosGlass: useNativeGlass,
      }),
    [isDark, theme.colors, resolvedTintColor, useNativeGlass],
  );

  const customContentWrapperStyle = React.useMemo(
    () => ({
      width: '100%',
      height: '100%',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    }),
    [],
  );

  const pressableStyle = React.useMemo<ViewStyle>(
    () => ({
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      ...(hasExplicitSize ? {width: '100%', height: '100%'} : {}),
    }),
    [hasExplicitSize],
  );

  const getButtonContent = () => {
    if (customContent) {
      return (
        <View style={customContentWrapperStyle}>
          {customContent}
        </View>
      );
    }

    return (
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={loadingColor}
            style={{marginRight: theme.spacing['2']}}
          />
        )}
        
        {leftIcon && (
          <View style={{marginRight: title ? theme.spacing['2'] : 0}}>
            {leftIcon}
          </View>
        )}
        
        {title && (
          <Text style={[buttonTextStyle, textStyle]}>{title}</Text>
        )}
        
        {rightIcon && (
          <View style={{marginLeft: title ? theme.spacing['2'] : 0}}>
            {rightIcon}
          </View>
        )}
      </View>
    );
  };

  const buttonContent = getButtonContent();

  // Use LiquidGlassView when supported
  if (useNativeGlass) {
    return (
      <LiquidGlassView
        style={[buttonStyle, style, {backgroundColor: 'transparent'}]}
        interactive={interactive && !disabled && !loading}
        effect={glassEffect}
        tintColor={resolvedTintColor}
        colorScheme={resolvedColorScheme}>
        <TouchableOpacity
          style={pressableStyle}
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={1}>
          {buttonContent}
        </TouchableOpacity>
      </LiquidGlassView>
    );
  }

  // Fallback for when liquid glass is not supported
  return (
    <TouchableOpacity
      style={[buttonStyle, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}>
      {buttonContent}
    </TouchableOpacity>
  );
};

export default LiquidGlassButton;
