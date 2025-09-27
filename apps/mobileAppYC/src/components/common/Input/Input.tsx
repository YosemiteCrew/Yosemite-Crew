import React, {useState} from 'react';
import {
  TextInput,
  View,
  Text,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import {useTheme} from '../../../hooks';

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
  ...textInputProps
}) => {
  const {theme} = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const getInputContainerStyle = (): ViewStyle => ({
    borderWidth: 1,
    borderColor: error
      ? theme.colors.error
      : isFocused
      ? theme.colors.primary
      : theme.colors.border,
    borderRadius: theme.borderRadius.base,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing['4'],
    paddingVertical: theme.spacing['3'],
    minHeight: 44,
  });

  const getInputStyle = (): TextStyle => ({
    ...theme.typography.body,
    color: theme.colors.text,
    flex: 1,
  });

  const getLabelStyle = (): TextStyle => ({
    ...theme.typography.labelSmall,
    color: theme.colors.text,
    marginBottom: theme.spacing['2'],
  });

  const getErrorStyle = (): TextStyle => ({
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: theme.spacing['1'],
  });

  return (
    <View style={containerStyle}>
      {label && (
        <Text style={[getLabelStyle(), labelStyle]}>{label}</Text>
      )}
      <View style={getInputContainerStyle()}>
        <TextInput
          style={[getInputStyle(), inputStyle]}
          placeholderTextColor={theme.colors.textSecondary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...textInputProps}
        />
      </View>
      {error && (
        <Text style={[getErrorStyle(), errorStyle]}>{error}</Text>
      )}
    </View>
  );
};