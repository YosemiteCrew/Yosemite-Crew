import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  PlatformColor,
  Platform,
  DimensionValue,
} from 'react-native';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import {useTheme} from '../../../hooks';

interface LiquidGlassButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'glass';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  glassEffect?: 'clear' | 'regular' | 'none';
  interactive?: boolean;
  tintColor?: string;
  colorScheme?: 'light' | 'dark' | 'system';
  // New props for dimensions
  width?: DimensionValue;
  height?: DimensionValue;
  minWidth?: DimensionValue;
  minHeight?: DimensionValue;
  maxWidth?: DimensionValue;
  maxHeight?: DimensionValue;
  // New props for border radius
  borderRadius?: number | keyof typeof import('../../../theme').borderRadius;
  // New props for custom fallback styling
  fallbackStyle?: ViewStyle;
  glassFallbackStyle?: ViewStyle; // Specific fallback for glass variant
  customGlassFallback?: {
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    shadowColor?: string;
    shadowOffset?: {width: number; height: number};
    shadowOpacity?: number;
    shadowRadius?: number;
    elevation?: number;
  };
}

export const LiquidGlassButton: React.FC<LiquidGlassButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  glassEffect = 'regular',
  interactive = true,
  tintColor,
  colorScheme = 'system',
  width,
  height,
  minWidth,
  minHeight,
  maxWidth,
  borderRadius,
  fallbackStyle,
  glassFallbackStyle,
  customGlassFallback,
}) => {
  const {theme, isDark} = useTheme();

  const getBorderRadius = (): number => {
    if (typeof borderRadius === 'number') {
      return borderRadius;
    }
    if (typeof borderRadius === 'string' && borderRadius in theme.borderRadius) {
      return theme.borderRadius[borderRadius as keyof typeof theme.borderRadius];
    }
    return theme.borderRadius.base;
  };

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: getBorderRadius(),
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      // Add dimension props
      width,
      height,
      minWidth,
      minHeight,
      maxWidth
    };

    // Size styles
    const sizeStyles: Record<string, ViewStyle> = {
      small: {
        paddingHorizontal: theme.spacing['3'],
        paddingVertical: theme.spacing['2'],
        minHeight: minHeight || height || 36,
      },
      medium: {
        paddingHorizontal: theme.spacing['4'],
        paddingVertical: theme.spacing['3'],
        minHeight: minHeight || height || 44,
      },
      large: {
        paddingHorizontal: theme.spacing['6'],
        paddingVertical: theme.spacing['4'],
        minHeight: minHeight || height || 52,
      },
    };

    // Default glass fallback styles
    const getDefaultGlassFallback = (): ViewStyle => {
      return {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.3)',
        ...theme.shadows.sm,
      };
    };

    // Variant styles
    const variantStyles: Record<string, ViewStyle> = {
      primary: {
        backgroundColor: disabled
          ? theme.colors.textSecondary
          : theme.colors.primary,
      },
      secondary: {
        backgroundColor: disabled
          ? theme.colors.textSecondary
          : theme.colors.secondary,
      },
      outline: {
        backgroundColor: theme.colors.transparent,
        borderWidth: 1,
        borderColor: disabled ? theme.colors.textSecondary : theme.colors.primary,
      },
      ghost: {
        backgroundColor: theme.colors.transparent,
      },
      glass: {
        // Fallback for non-liquid glass support
        ...(isLiquidGlassSupported 
          ? {
              backgroundColor: theme.colors.transparent,
              borderWidth: 0,
              borderColor: 'transparent',
            }
          : {
              ...getDefaultGlassFallback(),
              ...glassFallbackStyle, // This will override defaults with your custom style
              ...customGlassFallback, // This will override with detailed custom fallback if provided
            }
        ),
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      // Apply general fallback style if provided
      ...(variant !== 'glass' && !isLiquidGlassSupported && fallbackStyle),
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      ...(size === 'small' ? theme.typography.buttonSmall : theme.typography.button),
    };

    const getGlassTextColor = () => {
      if (Platform.OS === 'ios' && isLiquidGlassSupported) {
        return PlatformColor('labelColor');
      }
      // Custom fallback text color based on background
      if (customGlassFallback?.backgroundColor) {
        // Simple heuristic: if background is light, use dark text, else light text
        const bgColor = customGlassFallback.backgroundColor;
        if (bgColor.includes('255, 255, 255') && bgColor.includes('0.8')) {
          return theme.colors.text; // Dark text for light background
        }
      }
      return isDark ? theme.colors.white : theme.colors.text;
    };

    const variantStyles: Record<string, TextStyle> = {
      primary: {
        color: theme.colors.surface,
      },
      secondary: {
        color: theme.colors.surface,
      },
      outline: {
        color: disabled ? theme.colors.textSecondary : theme.colors.primary,
      },
      ghost: {
        color: disabled ? theme.colors.textSecondary : theme.colors.primary,
      },
      glass: {
        color: getGlassTextColor(),
      },
    };

    return {
      ...baseStyle,
      ...variantStyles[variant],
    };
  };

  const renderButton = (children: React.ReactNode) => (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}>
      {children}
    </TouchableOpacity>
  );

  const buttonContent = (
    <>
      {loading && (
        <ActivityIndicator
          size="small"
          color={
            variant === 'primary' || variant === 'secondary'
              ? theme.colors.surface
              : variant === 'glass' && isLiquidGlassSupported
              ? PlatformColor('labelColor')
              : variant === 'glass'
              ? (isDark ? theme.colors.white : theme.colors.text)
              : theme.colors.primary
          }
          style={{marginRight: theme.spacing['2']}}
        />
      )}
      <Text style={[getTextStyle(), textStyle]}>{title}</Text>
    </>
  );

  // If glass variant and liquid glass is supported, wrap in LiquidGlassView
  if (variant === 'glass' && Platform.OS === 'ios' && isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        style={[getButtonStyle(), style]}
        interactive={interactive && !disabled && !loading}
        effect={glassEffect}
        tintColor={tintColor}
        colorScheme={colorScheme}>
        <TouchableOpacity
          style={{
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
          }}
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={1}>
          {buttonContent}
        </TouchableOpacity>
      </LiquidGlassView>
    );
  }

  // Regular button for all other cases
  return renderButton(buttonContent);
};

// Helper function to create common glass fallback styles
export const createGlassFallback = {
  // Light glass effect
  light: (opacity: number = 0.8, radius?: number): ViewStyle => ({
    backgroundColor: `rgba(255, 255, 255, ${opacity})`,
    borderWidth: 1,
    borderColor: `rgba(255, 255, 255, ${Math.min(opacity + 0.2, 1)})`,
    borderRadius: radius,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  }),
  
  // Dark glass effect
  dark: (opacity: number = 0.1, radius?: number): ViewStyle => ({
    backgroundColor: `rgba(0, 0, 0, ${opacity})`,
    borderWidth: 1,
    borderColor: `rgba(255, 255, 255, ${Math.min(opacity * 2, 0.3)})`,
    borderRadius: radius,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  }),
  
  // Frosted effect with custom tint
  frosted: (tintColor: string = '#ffffff', opacity: number = 0.9, radius?: number): ViewStyle => ({
    backgroundColor: `${tintColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
    borderWidth: 1,
    borderColor: `${tintColor}ff`,
    borderRadius: radius,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  }),
  
  // Subtle glass
  subtle: (radius?: number): ViewStyle => ({
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radius,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  }),
};