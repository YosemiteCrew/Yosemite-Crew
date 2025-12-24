import React from 'react';
import {
  Platform,
  StyleProp,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import {useTheme} from '@/hooks';

const IOS_LIGHT_GLASS_TINT = 'rgba(255, 255, 255, 0.65)';
const IOS_DARK_GLASS_TINT = 'rgba(28, 28, 30, 0.55)';
const ANDROID_LIGHT_GLASS_TINT = 'rgba(255, 255, 255, 0.92)';
const ANDROID_DARK_GLASS_TINT = 'rgba(28, 28, 30, 0.82)';
const ANDROID_FALLBACK_BORDER_LIGHT = 'rgba(0, 0, 0, 0.08)';
const ANDROID_FALLBACK_BORDER_DARK = 'rgba(255, 255, 255, 0.12)';

interface LiquidGlassIconButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  size: number;
  style?: StyleProp<ViewStyle>;
  glassEffect?: 'clear' | 'regular' | 'none';
  tintColor?: string;
  colorScheme?: 'light' | 'dark' | 'system';
  shadow?: keyof typeof import('@/theme').shadows;
  disabled?: boolean;
}

export const LiquidGlassIconButton: React.FC<LiquidGlassIconButtonProps> = ({
  children,
  onPress,
  size,
  style,
  glassEffect = 'clear',
  tintColor,
  colorScheme = 'light',
  shadow = 'sm',
  disabled = false,
}) => {
  const {theme, isDark} = useTheme();
  const useNativeGlass = Platform.OS === 'ios' && isLiquidGlassSupported;
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
    if (Platform.OS === 'android') {
      return resolvedColorScheme === 'dark'
        ? ANDROID_DARK_GLASS_TINT
        : ANDROID_LIGHT_GLASS_TINT;
    }
    return resolvedColorScheme === 'dark' ? IOS_DARK_GLASS_TINT : IOS_LIGHT_GLASS_TINT;
  }, [resolvedColorScheme, tintColor]);

  const baseStyle = React.useMemo<ViewStyle>(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      ...theme.shadows[shadow],
      shadowColor: theme.colors.neutralShadow ?? theme.colors.black,
    }),
    [size, shadow, theme.colors.black, theme.colors.neutralShadow, theme.shadows],
  );

  const pressableStyle = React.useMemo<ViewStyle>(
    () => ({
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    [],
  );

  if (useNativeGlass) {
    return (
      <LiquidGlassView
        style={[baseStyle, style]}
        interactive={!disabled}
        effect={glassEffect}
        tintColor={resolvedTintColor}
        colorScheme={resolvedColorScheme}>
        <TouchableOpacity
          onPress={onPress}
          disabled={disabled}
          activeOpacity={0.85}
          style={pressableStyle}>
          {children}
        </TouchableOpacity>
      </LiquidGlassView>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        baseStyle,
        {
          backgroundColor: resolvedTintColor,
          ...(Platform.OS === 'android'
            ? {
                borderWidth: 1,
                borderColor:
                  resolvedColorScheme === 'dark'
                    ? ANDROID_FALLBACK_BORDER_DARK
                    : ANDROID_FALLBACK_BORDER_LIGHT,
              }
            : null),
        },
        style,
      ]}>
      <View style={pressableStyle}>{children}</View>
    </TouchableOpacity>
  );
};

export default LiquidGlassIconButton;
