// ============================================
// 1. Updated Input Component with Icon Support
// src/components/common/Input/Input.tsx
// ============================================

import React, { useState, useRef, useCallback } from 'react';
import {
  TextInput,
  View,
  Text,
  ViewStyle,
  TextStyle,
  TextInputProps,
  Animated,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@/hooks';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;
  icon?: React.ReactNode;
  onIconPress?: () => void;
  /**
   * Additional left offset applied only to the placeholder text so that
   * the placeholder can be visually indented without shifting the entered text.
   */
  placeholderOffset?: number;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  inputStyle,
  labelStyle,
  errorStyle,
  value,
  onFocus,
  onBlur,
  onChangeText,
  icon,
  onIconPress,
  placeholderOffset,
  ...textInputProps
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(!!value);
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  const animateLabel = useCallback((toValue: number) => {
    Animated.timing(animatedValue, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [animatedValue]);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    animateLabel(1);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (!value && !hasValue) {
      animateLabel(0);
    }
    onBlur?.(e);
  };

  const handleChangeText = (text: string) => {
    setHasValue(!!text);
    onChangeText?.(text);
  };

  React.useEffect(() => {
    const hasExternalValue =
      value !== undefined && value !== null && `${value}`.length > 0;

    if (hasValue !== hasExternalValue) {
      setHasValue(hasExternalValue);
    }
  }, [value, hasValue]);

  React.useEffect(() => {
    const shouldAnimateUp = !!value || hasValue;
    if (shouldAnimateUp) {
      animateLabel(1);
    } else {
      animateLabel(0);
    }
  }, [value, hasValue, animateLabel]);

  const getInputContainerStyle = (): ViewStyle => {
    let borderColor = theme.colors.border;
    if (error) {
      borderColor = theme.colors.error;
    } else if (isFocused) {
      borderColor = theme.colors.primary;
    }

    return {
      borderWidth: 1,
      borderColor,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 20,
      minHeight: 56,
      position: 'relative',
      justifyContent: 'center',
      flexDirection: 'row',
      alignItems: 'center',
    };
  };

  const getInputStyle = (): TextStyle => ({
    ...theme.typography.input,
    color: hasValue || isFocused ? theme.colors.text : theme.colors.placeholder,
    fontFamily: hasValue || isFocused
      ? theme.typography.inputFilled.fontFamily
      : theme.typography.input.fontFamily,
    fontWeight: hasValue || isFocused
      ? theme.typography.inputFilled.fontWeight
      : theme.typography.input.fontWeight,
    letterSpacing: hasValue || isFocused
      ? theme.typography.inputFilled.letterSpacing
      : theme.typography.input.letterSpacing,
    flex: 1,
    ...(Platform.OS === 'ios' 
      ? {
          paddingTop: label ? 10 : 12,
          paddingBottom: label ? 8 : 12,
          lineHeight: undefined,
        }
      : {
          paddingTop: label ? 10 : 8,
          paddingBottom: 8,
          textAlignVertical: 'center',
        }
    ),
    paddingHorizontal: 0,
    margin: 0,
    minHeight: Platform.OS === 'ios' ? 20 : 24,
    height: undefined,
  });

  // We no longer adjust the TextInput padding for placeholderOffset.
  // Instead we shift the floating label's absolute left position when
  // the label is in the placeholder state. This gives visual offset
  // for the placeholder text without affecting entered text alignment.
  const effectivePlaceholderOffset = placeholderOffset ?? 0;

  const getFloatingLabelStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      // left will be animated between placeholder position (20 + offset)
      // when not floated and the regular left (20) when floated.
      left: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [20 + effectivePlaceholderOffset, 20],
      }),
      fontFamily: theme.typography.input.fontFamily,
      fontWeight: theme.typography.input.fontWeight,
      fontSize: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [16, 14],
      }),
      top: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [
          Platform.OS === 'ios' ? 18 : 15,
          Platform.OS === 'ios' ? -6 : -10,
        ],
      }),
      color: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [
          theme.colors.textSecondary,
          isFocused ? theme.colors.primary : theme.colors.textSecondary,
        ],
      }),
      letterSpacing: theme.typography.inputLabel.letterSpacing,
      backgroundColor: theme.colors.surface || theme.colors.background,
      paddingHorizontal: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 4],
      }),
      paddingVertical: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      }),
      zIndex: 1,
        pointerEvents: 'none' as const,
    };

    if (Platform.OS === 'ios') {
      return {
        ...baseStyle,
        includeFontPadding: false,
        textAlignVertical: 'center' as const,
      };
    }

    return baseStyle;
  };

  const getErrorStyle = (): TextStyle => ({
    ...theme.typography.labelXsBold,
    color: theme.colors.error,
    marginTop: 3,
    marginBottom: theme.spacing?.[3] || 12,
    marginLeft: theme.spacing?.[1] || 4,
  });

  let IconWrapper = null;
  if (icon) {
    IconWrapper = onIconPress ? TouchableOpacity : View;
  }

  return (
    <View style={containerStyle}>
      <View style={getInputContainerStyle()}>
        {label && (
          <Animated.Text style={[getFloatingLabelStyle(), labelStyle]}>
            {label}
          </Animated.Text>
        )}
        <TextInput
          style={[getInputStyle(), inputStyle]}
          placeholderTextColor={theme.colors.placeholder}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeText={handleChangeText}
          value={value}
          clearButtonMode="while-editing"
          enablesReturnKeyAutomatically={true}
          {...textInputProps}
        />
        {icon && IconWrapper && (
          <IconWrapper onPress={onIconPress} activeOpacity={0.7}>
            {icon}
          </IconWrapper>
        )}
      </View>
      {error && (
        <Text style={[getErrorStyle(), errorStyle]}>{error}</Text>
      )}
    </View>
  );
};
