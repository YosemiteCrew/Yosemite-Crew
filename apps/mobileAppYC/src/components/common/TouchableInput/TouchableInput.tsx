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
  Platform,
} from 'react-native';
import { useTheme } from '../../../hooks';

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

  const getInputContainerStyle = (): ViewStyle => ({
    borderWidth: 2,
    borderColor: error
      ? theme.colors.error
      : theme.colors.border,
    borderRadius: 15,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    minHeight: 56,
    position: 'relative',
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    opacity: disabled ? 0.6 : 1,
  });

  const getValueStyle = (): TextStyle => ({
    ...(hasValue ? theme.typography.inputFilled : theme.typography.input),
    color: hasValue ? theme.colors.text : theme.colors.textSecondary,
    fontSize: 16,
    lineHeight: 20,
    flex: 1,
    ...(Platform.OS === 'ios'
      ? {
          paddingTop: hasValue ? 10 : 12,
          paddingBottom: hasValue ? 8 : 12,
        }
      : {
          paddingTop: hasValue ? 10 : 8,
          paddingBottom: 8,
          textAlignVertical: 'center',
        }
    ),
    paddingHorizontal: 0,
    margin: 0,
    minHeight: Platform.OS === 'ios' ? 20 : 24,
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
          Platform.OS === 'ios' ? 18 : 15,
          Platform.OS === 'ios' ? -6 : -10,
        ],
      }),
      color: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [
          theme.colors.textSecondary,
          theme.colors.textSecondary,
        ],
      }),
      backgroundColor: theme.colors.surface || theme.colors.background,
      paddingHorizontal: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 4],
      }),
      zIndex: 1,
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
        <View style={[getInputContainerStyle(), inputStyle]}>
          {/* Only show the floating label when there's a value */}
          {label && hasValue && (
            <Animated.Text style={[getFloatingLabelStyle(), labelStyle]}>
              {label}
            </Animated.Text>
          )}
          
          {leftComponent && (
            <View style={{ marginRight: 12 }}>
              {leftComponent}
            </View>
          )}

          <Text style={getValueStyle()}>
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