// src/components/common/TouchableInput/TouchableInput.tsx
import React, {useCallback, useEffect} from 'react';
import {View, Text, TouchableOpacity, ViewStyle, TextStyle} from 'react-native';
import Animated, {useSharedValue, withTiming} from 'react-native-reanimated';
import {useTheme} from '@/hooks';
import {
  useFloatingLabelAnimatedStyle,
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
  const animatedValue = useSharedValue(value ? 1 : 0);
  const hasValue = !!value;

  const animateLabel = useCallback(
    (toValue: number) => {
      animatedValue.value = withTiming(toValue, {duration: 200});
    },
    [animatedValue],
  );

  useEffect(() => {
    if (hasValue) {
      animateLabel(1);
    } else {
      animateLabel(0);
    }
  }, [hasValue, animateLabel]);

  const inputContainerStyle: ViewStyle = {
    ...getInputContainerBaseStyle(theme, error),
    flexDirection: 'row',
    alignItems: 'center',
    opacity: disabled ? 0.6 : 1,
  };

  const valueStyle = getValueTextStyle(theme, hasValue);
  const floatingLabelStyle = useFloatingLabelAnimatedStyle({
    animatedValue,
    theme,
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
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        disabled={disabled}>
        <View style={[inputContainerStyle, inputStyle]}>
          {/* Only show the floating label when there's a value */}
          {label && hasValue && (
            <Animated.Text style={[floatingLabelStyle, labelStyle]}>
              {label}
            </Animated.Text>
          )}

          {leftComponent && (
            <View style={leftComponentWrapperStyle}>{leftComponent}</View>
          )}

          <Text style={valueStyle}>{value || placeholder}</Text>

          {rightComponent && (
            <View style={rightComponentWrapperStyle}>{rightComponent}</View>
          )}
        </View>
      </TouchableOpacity>

      {error && <Text style={[getErrorStyle(), errorStyle]}>{error}</Text>}
    </View>
  );
};
