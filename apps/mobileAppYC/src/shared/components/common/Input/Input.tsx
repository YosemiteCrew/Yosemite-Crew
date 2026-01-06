// ============================================
// 1. Updated Input Component with Icon Support
// src/components/common/Input/Input.tsx
// ============================================

import React, { useState, useRef, useCallback } from 'react';
import {
  Keyboard,
  TextInput,
  View,
  Text,
  ViewStyle,
  TextStyle,
  TextInputProps,
  Animated,
  Platform,
  TouchableOpacity,
  useColorScheme,
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
  const systemColorScheme = useColorScheme();
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(!!value);
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const isMultiline = Boolean(textInputProps.multiline);
  const keyboardAppearance =
    systemColorScheme === 'dark' ? 'dark' : 'light';

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
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing['5'],
      minHeight: theme.spacing['14'],
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
          paddingTop: label ? theme.spacing['2.5'] : theme.spacing['3'],
          paddingBottom: label ? theme.spacing['2'] : theme.spacing['3'],
          lineHeight: undefined,
        }
      : {
          paddingTop: label ? theme.spacing['2.5'] : theme.spacing['2'],
          paddingBottom: theme.spacing['2'],
          textAlignVertical: 'center',
        }
    ),
    paddingHorizontal: 0,
    margin: 0,
    minHeight: Platform.OS === 'ios' ? theme.spacing['5'] : theme.spacing['6'],
    height: undefined,
  });

  // We no longer adjust the TextInput padding for placeholderOffset.
  // Instead we shift the floating label's absolute left position when
  // the label is in the placeholder state. This gives visual offset
  // for the placeholder text without affecting entered text alignment.
  const effectivePlaceholderOffset = placeholderOffset ?? 0;
  const placeholderLineHeight =
    theme.typography.input.lineHeight ?? theme.typography.input.fontSize;
  const placeholderTop =
    (theme.spacing['14'] - placeholderLineHeight) / 2 - 2;
  const labelLineHeight =
    theme.typography.inputLabel.lineHeight ?? theme.typography.inputLabel.fontSize;
  const floatingTop = -Math.round(labelLineHeight / 2) - 2;

  const getFloatingLabelStyle = () => {
    const baseStyle = {
      position: 'absolute' as const,
      // left will be animated between placeholder position (20 + offset)
      // when not floated and the regular left (20) when floated.
      left: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.spacing['5'] + effectivePlaceholderOffset, theme.spacing['5']],
      }),
      fontFamily: theme.typography.input.fontFamily,
      fontWeight: theme.typography.input.fontWeight,
      fontSize: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.typography.input.fontSize, theme.typography.inputLabel.fontSize],
      }),
      top: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [
          placeholderTop,
          floatingTop,
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
        outputRange: [0, theme.spacing['1']],
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
    ...theme.typography.labelXxsBold,
    color: theme.colors.error,
    marginTop: theme.spacing['1'],
    marginBottom: theme.spacing['3'],
    marginLeft: theme.spacing['1'],
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
          keyboardAppearance={
            textInputProps.keyboardAppearance ?? keyboardAppearance
          }
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeText={handleChangeText}
          value={value}
          clearButtonMode="while-editing"
          enablesReturnKeyAutomatically={true}
          returnKeyType={textInputProps.returnKeyType ?? 'done'}
          onSubmitEditing={(event) => {
            textInputProps.onSubmitEditing?.(event);
            if (!isMultiline) {
              Keyboard.dismiss();
            }
          }}
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
