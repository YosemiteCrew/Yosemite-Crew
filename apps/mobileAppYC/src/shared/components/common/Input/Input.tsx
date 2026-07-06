// ============================================
// 1. Updated Input Component with Icon Support
// src/components/common/Input/Input.tsx
// ============================================

import React, {useState, useCallback} from 'react';
import {
  Keyboard,
  TextInput,
  View,
  Text,
  ViewStyle,
  TextStyle,
  TextInputProps,
  Platform,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import Animated, {useSharedValue, withTiming} from 'react-native-reanimated';
import {useTheme} from '@/hooks';
import {
  useFloatingLabelAnimatedStyle,
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
  const {theme} = useTheme();
  const systemColorScheme = useColorScheme();
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(
    value !== undefined && value !== null && `${value}`.length > 0,
  );
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    const nextHasValue =
      value !== undefined && value !== null && `${value}`.length > 0;
    if (hasValue !== nextHasValue) {
      setHasValue(nextHasValue);
    }
  }
  const animatedValue = useSharedValue(value ? 1 : 0);
  const {
    keyboardAppearance: keyboardAppearanceProp,
    returnKeyType: returnKeyTypeProp,
    returnKeyLabel: returnKeyLabelProp,
    onSubmitEditing,
    ...restTextInputProps
  } = textInputProps;
  const isMultiline = Boolean(restTextInputProps.multiline);
  const keyboardAppearance = systemColorScheme === 'dark' ? 'dark' : 'light';
  const resolvedKeyboardAppearance =
    keyboardAppearanceProp ?? keyboardAppearance;
  const resolvedReturnKeyType = returnKeyTypeProp ?? 'done';
  const resolvedReturnKeyLabel = returnKeyLabelProp ?? 'Done';

  const animateLabel = useCallback(
    (toValue: number) => {
      animatedValue.value = withTiming(toValue, {duration: 200});
    },
    [animatedValue],
  );

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
    const newHasValue = !!text;
    setHasValue(newHasValue);
    animateLabel(newHasValue ? 1 : 0);
    onChangeText?.(text);
  };

  React.useEffect(() => {
    const hasExternalValue =
      value !== undefined && value !== null && `${value}`.length > 0;
    animateLabel(hasExternalValue ? 1 : 0);
  }, [value, animateLabel]);

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
      color:
        hasValue || isFocused ? theme.colors.text : theme.colors.placeholder,
      fontFamily:
        hasValue || isFocused
          ? theme.typography.inputFilled.fontFamily
          : theme.typography.input.fontFamily,
      fontWeight:
        hasValue || isFocused
          ? theme.typography.inputFilled.fontWeight
          : theme.typography.input.fontWeight,
      letterSpacing:
        hasValue || isFocused
          ? theme.typography.inputFilled.letterSpacing
          : theme.typography.input.letterSpacing,
      lineHeight: Platform.OS === 'ios' ? undefined : baseStyle.lineHeight,
      height: undefined,
    };
  };

  const effectivePlaceholderOffset = placeholderOffset ?? 0;
  const floatingLabelStyle = useFloatingLabelAnimatedStyle({
    animatedValue,
    theme,
    focused: isFocused,
    placeholderOffset: effectivePlaceholderOffset,
  });

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
          <Animated.Text style={[floatingLabelStyle, labelStyle]}>
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
          onSubmitEditing={event => {
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
      {error && <Text style={[getErrorStyle(), errorStyle]}>{error}</Text>}
    </View>
  );
};
