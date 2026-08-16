// src/shared/components/common/TouchableInput/TouchableInput.tsx
import React from 'react';
import {View, Text, ViewStyle, TextStyle} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {
  getInputContainerBaseStyle,
  getInputErrorStyle,
  getInputLabelStyle,
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

  const leftComponentWrapperStyle = {
    marginRight: theme.spacing['3'],
  };

  const rightComponentWrapperStyle = {
    marginLeft: theme.spacing['2'],
  };

  return (
    <View style={containerStyle}>
      {label && (
        <Text style={[getInputLabelStyle(theme), labelStyle]}>{label}</Text>
      )}
      <PressableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={[label, value || placeholder]
          .filter(Boolean)
          .join(', ')}
        accessibilityState={{disabled}}>
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

      {error && (
        <Text style={[getInputErrorStyle(theme), errorStyle]}>{error}</Text>
      )}
    </View>
  );
};
