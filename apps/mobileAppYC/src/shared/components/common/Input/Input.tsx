// ============================================
// Input component - warm-bone static label above the field.
// src/shared/components/common/Input/Input.tsx
// ============================================

import React, {useState} from 'react';
import {
  Keyboard,
  TextInput,
  View,
  Text,
  ViewStyle,
  TextStyle,
  TextInputProps,
  Platform,
  useColorScheme,
} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {
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

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const handleChangeText = (text: string) => {
    setHasValue(!!text);
    onChangeText?.(text);
  };

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

  // Static label sits above the field; it turns red to echo an error.
  const getLabelStyle = (): TextStyle => ({
    ...theme.typography.inputLabel,
    color: error ? theme.colors.error : theme.colors.inkMuted,
    marginBottom: theme.spacing['2'],
    marginLeft: theme.spacing['1'],
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
    IconWrapper = onIconPress ? PressableOpacity : View;
  }

  return (
    <View style={containerStyle}>
      {label && <Text style={[getLabelStyle(), labelStyle]}>{label}</Text>}
      <View style={getInputContainerStyle()}>
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
