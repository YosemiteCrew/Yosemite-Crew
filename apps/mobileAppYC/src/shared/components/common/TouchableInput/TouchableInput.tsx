// src/shared/components/common/TouchableInput/TouchableInput.tsx
import React from 'react';
import {View, Text, ViewStyle, TextStyle} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {
  getInputContainerBaseStyle,
  getValueTextStyle,
} from '../shared/floatingLabelStyles';

interface TouchableInputProps {
  label?: string;
  value?: string;
  placeholder?: string;
  error?: string;
  onPress: () => void;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;
  disabled?: boolean;
}

export const TouchableInput: React.FC<TouchableInputProps> = ({
  label,
  value,
  placeholder,
  error,
  onPress,
  leftComponent,
  rightComponent,
  containerStyle,
  inputStyle,
  labelStyle,
  errorStyle,
  disabled = false,
}) => {
  const {theme} = useTheme();
  const hasValue = !!value;

  const inputContainerStyle: ViewStyle = {
    ...getInputContainerBaseStyle(theme, error),
    flexDirection: 'row',
    alignItems: 'center',
    opacity: disabled ? 0.6 : 1,
  };

  const valueStyle = getValueTextStyle(theme, hasValue);

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

  const leftComponentWrapperStyle = {
    marginRight: theme.spacing['3'],
  };

  const rightComponentWrapperStyle = {
    marginLeft: theme.spacing['2'],
  };

  return (
    <View style={containerStyle}>
      {label && <Text style={[getLabelStyle(), labelStyle]}>{label}</Text>}
      <PressableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        disabled={disabled}>
        <View style={[inputContainerStyle, inputStyle]}>
          {leftComponent && (
            <View style={leftComponentWrapperStyle}>{leftComponent}</View>
          )}

          <Text style={valueStyle}>{value || placeholder}</Text>

          {rightComponent && (
            <View style={rightComponentWrapperStyle}>{rightComponent}</View>
          )}
        </View>
      </PressableOpacity>

      {error && <Text style={[getErrorStyle(), errorStyle]}>{error}</Text>}
    </View>
  );
};
