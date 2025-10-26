// src/components/common/OTPInput/OTPInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
} from 'react-native';
import { useTheme } from '../../../hooks';
import {generateId} from '@/utils/helpers';

interface OTPInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  error?: string;
  autoFocus?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length = 4,
  onComplete,
  error,
  autoFocus = true,
}) => {
  const { theme } = useTheme();
  const [otp, setOtp] = useState<string[]>(() => Array.from({ length }, () => ''));
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>(new Array(length).fill(null));
  const inputKeys = useRef<string[]>(Array.from({ length }, () => generateId()));

  useEffect(() => {
    if (inputKeys.current.length !== length) {
      inputKeys.current = Array.from({ length }, (_unused, index) => inputKeys.current[index] ?? generateId());
    }
    setOtp(prev => Array.from({ length }, (_unused, index) => prev[index] ?? ''));
    inputRefs.current = new Array(length).fill(null);
    setActiveIndex(0);
  }, [length]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [autoFocus]);

  const handleChange = (value: string, index: number) => {
    // Only allow numeric input
    if (value && Number.isNaN(Number(value))) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Always call onComplete to notify parent of changes (for error clearing)
    onComplete(newOtp.join(''));

    // Move to next input if value is entered and not at last input
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      setActiveIndex(index + 1);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (otp[index] === '' && index > 0) {
        // Move to previous input if current is empty
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        onComplete(newOtp.join(''));
        inputRefs.current[index - 1]?.focus();
        setActiveIndex(index - 1);
      } else {
        // Clear current input
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
        onComplete(newOtp.join(''));
      }
    }
  };

  const handleFocus = (index: number) => {
    setActiveIndex(index);
  };

  const handleTextInputSelection = (index: number) => {
    // Select all text when input is focused for better UX
    if (otp[index]) {
      return { start: 0, end: 1 };
    }
    return { start: 0, end: 0 };
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        {inputKeys.current.map((key, index) => {
          const digit = otp[index] ?? '';
          return (
          <TextInput
            key={key}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            style={[
              styles.input,
              {
                borderColor: (() => {
                  if (error) {
                    return theme.colors.error;
                  }
                  if (activeIndex === index) {
                    return theme.colors.primary;
                  }
                  return theme.colors.border;
                })(),
                backgroundColor: theme.colors.backgroundSecondary || theme.colors.background,
                color: theme.colors.text,
              },
            ]}
            value={digit}
            onChangeText={(value) => handleChange(value, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            onFocus={() => handleFocus(index)}
            keyboardType="numeric"
            maxLength={1}
            selectTextOnFocus
            selection={handleTextInputSelection(index)}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="oneTimeCode"
          />
          );
        })}
      </View>
      {error && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 240,
    paddingHorizontal: 10,
  },
  input: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 5,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});
