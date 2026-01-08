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
import {
  getFloatingLabelAnimatedStyle,
  getInputContainerBaseStyle,
  getValueTextStyle,
} from '@/shared/components/common/shared/floatingLabelStyles';

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
  const {
    keyboardAppearance: keyboardAppearanceProp,
    returnKeyType: returnKeyTypeProp,
    returnKeyLabel: returnKeyLabelProp,
    onSubmitEditing,
    ...restTextInputProps
  } = textInputProps;
  const isMultiline = Boolean(restTextInputProps.multiline);
  const keyboardAppearance =
    systemColorScheme === 'dark' ? 'dark' : 'light';
  const resolvedKeyboardAppearance =
    keyboardAppearanceProp ?? keyboardAppearance;
  const resolvedReturnKeyType = returnKeyTypeProp ?? 'done';
  const resolvedReturnKeyLabel = returnKeyLabelProp ?? 'Done';

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
    const baseStyle = getInputContainerBaseStyle(theme, error);
    let borderColor = baseStyle.borderColor;

    if (isFocused && !error) {
      borderColor = theme.colors.primary;
    }

    return {
      ...baseStyle,
      borderColor,
      flexDirection: 'row',
      alignItems: 'center',
    };
  };

  const getInputStyle = (): TextStyle => {
    const baseStyle = getValueTextStyle(theme, hasValue || isFocused);
    return {
      ...baseStyle,
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
      lineHeight: Platform.OS === 'ios' ? undefined : baseStyle.lineHeight,
      height: undefined,
    };
  };

  const effectivePlaceholderOffset = placeholderOffset ?? 0;

  const getFloatingLabelStyle = () => {
    const baseStyle = getFloatingLabelAnimatedStyle({
      animatedValue,
      theme,
    });

    // Apply placeholder offset for the left position animation
    return {
      ...baseStyle,
      left: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.spacing['5'] + effectivePlaceholderOffset, theme.spacing['5']],
      }),
      color: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [
          theme.colors.textSecondary,
          isFocused ? theme.colors.primary : theme.colors.textSecondary,
        ],
      }),
    };
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
          keyboardAppearance={resolvedKeyboardAppearance}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeText={handleChangeText}
          value={value}
          clearButtonMode="while-editing"
          enablesReturnKeyAutomatically={true}
          returnKeyType={resolvedReturnKeyType}
          returnKeyLabel={resolvedReturnKeyLabel}
          onSubmitEditing={(event) => {
            onSubmitEditing?.(event);
            if (!isMultiline) {
              Keyboard.dismiss();
            }
          }}
          {...restTextInputProps}
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
