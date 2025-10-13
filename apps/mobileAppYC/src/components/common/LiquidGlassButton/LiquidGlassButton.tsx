/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  PlatformColor,
  Platform,
  DimensionValue,
  View,
} from 'react-native';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import {useTheme} from '../../../hooks';

interface GlassButtonProps {
  title?: string;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  glassEffect?: 'clear' | 'regular' | 'none';
  interactive?: boolean;
  tintColor?: string;
  colorScheme?: 'light' | 'dark' | 'system';
  width?: DimensionValue;
  height?: DimensionValue;
  minWidth?: DimensionValue;
  minHeight?: DimensionValue;
  maxWidth?: DimensionValue;
  borderRadius?: number | keyof typeof import('../../../theme').borderRadius;
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
  customContent,
  leftIcon,
  rightIcon,
  forceBorder = false,
  borderColor,
  shadowIntensity = 'light',
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

  const isWhiteOrLightColor = (color?: string): boolean => {
    if (!color) return false;
    
    // Check for white variations
    const whiteColors = ['#ffffff', '#fff', 'white', 'rgba(255,255,255,1)', 'rgba(255, 255, 255, 1)'];
    if (whiteColors.includes(color.toLowerCase().replace(/\s/g, ''))) return true;
    
    // Check for light colors (simplified luminance check)
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.9; // Very light colors
    }
    
    return false;
  };

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: getBorderRadius(),
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      width,
      height,
      minWidth,
      minHeight,
      maxWidth,
      overflow: 'hidden',
    };

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

    // Enhanced styling for glass effect visibility
    const getGlassStyle = (): ViewStyle => {
      const isLightTint = isWhiteOrLightColor(tintColor);
      
      const getShadowStyle = () => {
        if (shadowIntensity === 'none') return {};
        
        const shadows = {
          light: { shadowOpacity: 0.1, shadowRadius: 4, elevation: 1 },
          medium: { shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
          strong: { shadowOpacity: 0.25, shadowRadius: 12, elevation: 5 },
        };
        
        return {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          ...shadows[shadowIntensity],
        };
      };
      
      if (isLiquidGlassSupported) {
        // For glass effect, add border and shadow to improve visibility
        const shouldAddBorder = forceBorder || isLightTint;
        
        return {
          borderWidth: shouldAddBorder ? 1 : 0.5,
          borderColor: borderColor || (isLightTint 
            ? 'rgba(0, 0, 0, 0.15)' // Dark border for light/white tints
            : 'rgba(255, 255, 255, 0.2)'), // Light border for dark tints
          ...(isLightTint || forceBorder ? getShadowStyle() : {}),
        };
      }

      // Fallback style when liquid glass is not supported
      return {
        backgroundColor: tintColor || (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 1)'),
        borderWidth: 1,
        borderColor: borderColor || (tintColor 
          ? (isLightTint ? 'rgba(0, 0, 0, 0.15)' : `${tintColor}40`)
          : isDark 
            ? 'rgba(255, 255, 255, 0.2)' 
            : 'rgba(0, 0, 0, 0.1)'),
        // ...getShadowStyle(),
      };
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...getGlassStyle(),
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      ...(size === 'small' ? theme.typography.buttonSmall : theme.typography.button),
    };

    const getTextColor = () => {
      if (disabled) {
        return theme.colors.textSecondary;
      }
      
      if (Platform.OS === 'ios' && isLiquidGlassSupported) {
        // For white/light glass on white background, use darker text for contrast
        if (isWhiteOrLightColor(tintColor)) {
          return theme.colors.text; // Use primary text color for better contrast
        }
        // Fallback if PlatformColor is not available in test env
        return typeof PlatformColor === 'function'
          ? PlatformColor('labelColor')
          : (isDark ? theme.colors.white : theme.colors.text);
      }
      
      // For fallback, determine text color based on tint color or theme
      if (tintColor) {
        // For light/white backgrounds, use dark text; for dark backgrounds, use white text
        return isWhiteOrLightColor(tintColor) ? theme.colors.text : theme.colors.white;
      }
      
      return isDark ? theme.colors.white : theme.colors.text;
    };

    return {
      ...baseStyle,
      color: getTextColor(),
    };
  };

  const getButtonContent = () => {
    if (customContent) {
      return customContent;
    }

    const getLoadingColor = () => {
      if (Platform.OS === 'ios' && isLiquidGlassSupported) {
        // For white/light glass, use darker spinner
        if (isWhiteOrLightColor(tintColor)) {
          return theme.colors.text;
        }
        // Fallback if PlatformColor is not available in test env
        return typeof PlatformColor === 'function'
          ? PlatformColor('labelColor')
          : (isDark ? theme.colors.white : theme.colors.text);
      }
      if (tintColor) {
        return isWhiteOrLightColor(tintColor) ? theme.colors.text : theme.colors.white;
      }
      return isDark ? theme.colors.white : theme.colors.text;
    };

    return (
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={getLoadingColor()}
            style={{marginRight: theme.spacing['2']}}
          />
        )}
        
        {leftIcon && (
          <View style={{marginRight: title ? theme.spacing['2'] : 0}}>
            {leftIcon}
          </View>
        )}
        
        {title && (
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
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
  if (Platform.OS === 'ios' && isLiquidGlassSupported) {
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

  // Fallback for when liquid glass is not supported
  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}>
      {buttonContent}
    </TouchableOpacity>
  );
};

export default LiquidGlassButton;
