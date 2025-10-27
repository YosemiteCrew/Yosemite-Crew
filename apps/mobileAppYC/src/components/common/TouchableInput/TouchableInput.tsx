/* eslint-disable react-native/no-inline-styles */
// src/components/common/TouchableInput/TouchableInput.tsx
import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native';
import { useTheme } from '../../../hooks';
import {
  getFloatingLabelAnimatedStyle,
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
  const { theme } = useTheme();
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const hasValue = !!value;

  const animateLabel = useCallback((toValue: number) => {
    Animated.timing(animatedValue, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [animatedValue]);

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
  const floatingLabelStyle = getFloatingLabelAnimatedStyle({animatedValue, theme});

  const getErrorStyle = (): TextStyle => ({
    ...theme.typography.labelXsBold,
    color: theme.colors.error,
    marginTop: -(theme.spacing?.[3] || 12),
    marginBottom: theme.spacing?.[3] || 12,
    marginLeft: theme.spacing?.[1] || 4,
  });

  return (
    <View style={containerStyle}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <View style={[inputContainerStyle, inputStyle]}>
          {/* Only show the floating label when there's a value */}
          {label && hasValue && (
            <Animated.Text style={[floatingLabelStyle, labelStyle]}>
              {label}
            </Animated.Text>
          )}

          {leftComponent && (
            <View style={{ marginRight: 12 }}>
              {leftComponent}
            </View>
          )}

          <Text style={valueStyle}>
            {value || placeholder}
          </Text>

          {rightComponent && (
            <View style={{ marginLeft: 8 }}>
              {rightComponent}
            </View>
          )}
        </View>
      </TouchableOpacity>
      
      {error && (
        <Text style={[getErrorStyle(), errorStyle]}>{error}</Text>
      )}
    </View>
  );
};