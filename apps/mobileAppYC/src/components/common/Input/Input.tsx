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
} from 'react-native';
import { useTheme } from '../../../hooks';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;
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
    // Check both value prop and hasValue state for iOS compatibility
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
    const shouldAnimateUp = !!value || hasValue;
    if (shouldAnimateUp) {
      animateLabel(1);
    } else {
      animateLabel(0);
    }
  }, [value, hasValue, animateLabel]);

  const getInputContainerStyle = (): ViewStyle => ({
    borderWidth: 2,
    borderColor: error
      ? theme.colors.error
      : isFocused
      ? theme.colors.primary
      : theme.colors.border,
    borderRadius: 15,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    minHeight: 56,
    position: 'relative',
    justifyContent: 'center',
  });

  const getInputStyle = (): TextStyle => ({
    ...theme.typography.body,
    color: theme.colors.text,
    fontSize: 16,
    // iOS-specific fixes for text positioning
    ...(Platform.OS === 'ios' 
      ? {
          paddingTop: label ? 10 : 12, // Increased for iOS
          paddingBottom: label ? 8 : 12,
          lineHeight: undefined, // Let iOS handle line height
        }
      : {
          paddingTop: label ? 10 : 8,
          paddingBottom: 8,
          textAlignVertical: 'center',
        }
    ),
    paddingHorizontal: 0,
    margin: 0,
    minHeight: Platform.OS === 'ios' ? 20 : 24, // Smaller min height for iOS
    // Remove any conflicting height properties
    height: undefined,
  });

  const getFloatingLabelStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      left: 20,
      fontSize: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [16, 12],
      }),
      top: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [
          Platform.OS === 'ios' ? 18 : 15, // Consistent positioning
          Platform.OS === 'ios' ? -6 : -8,  // Slightly different for iOS
        ],
      }),
      color: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [
          theme.colors.textSecondary,
          isFocused ? theme.colors.primary : theme.colors.textSecondary,
        ],
      }),
      backgroundColor: theme.colors.surface || theme.colors.background,
      paddingHorizontal: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 4],
      }),
      zIndex: 1,
    };

    // iOS-specific fixes for label positioning
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
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: theme.spacing?.['1'] || 4,
    marginLeft: 20,
    fontSize: 12,
  });

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
          placeholderTextColor={theme.colors.textSecondary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeText={handleChangeText}
          value={value}
          // iOS-specific props to prevent text jumping
          clearButtonMode="while-editing" // iOS native clear button
          enablesReturnKeyAutomatically={true}
          {...textInputProps}
        />
      </View>
      {error && (
        <Text style={[getErrorStyle(), errorStyle]}>{error}</Text>
      )}
    </View>
  );
};