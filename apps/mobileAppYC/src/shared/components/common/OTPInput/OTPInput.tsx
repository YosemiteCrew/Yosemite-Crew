// src/components/common/OTPInput/OTPInput.tsx
import React, {useState, useEffect} from 'react';
import {View, TextInput, StyleSheet, Text, Platform} from 'react-native';
import {useTheme} from '@/hooks';
import {useLazyRef} from '@/shared/hooks/useLazyRef';
import {generateId} from '@/shared/utils/helpers';

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
  const {theme} = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [otp, setOtp] = useState<string[]>(() =>
    Array.from({length}, () => ''),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRefs = useLazyRef<(TextInput | null)[]>(() =>
    new Array(length).fill(null),
  );
  const inputKeys = useLazyRef<string[]>(() =>
    Array.from({length}, () => generateId()),
  );

  const [prevLength, setPrevLength] = useState(length);
  if (length !== prevLength) {
    setPrevLength(length);
    if (inputKeys.current.length !== length) {
      inputKeys.current = Array.from(
        {length},
        (_unused, index) => inputKeys.current[index] ?? generateId(),
      );
    }
    inputRefs.current = new Array(length).fill(null);
    setActiveIndex(0);
    setOtp(prev => Array.from({length}, (_unused, index) => prev[index] ?? ''));
  }

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      const id = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
      return () => clearTimeout(id);
    }
  }, [autoFocus, inputRefs]);

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
      return {start: 0, end: 1};
    }
    return {start: 0, end: 0};
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        {inputKeys.current.map((key, index) => {
          const digit = otp[index] ?? '';
          return (
            <TextInput
              key={key}
              ref={ref => {
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
                      return theme.colors.blue;
                    }
                    return theme.colors.hairline;
                  })(),
                  backgroundColor: theme.colors.fieldBg,
                  color: theme.colors.ink,
                },
                activeIndex === index && !error ? styles.inputActive : null,
              ]}
              value={digit}
              onChangeText={value => handleChange(value, index)}
              onKeyPress={e => handleKeyPress(e, index)}
              onFocus={() => handleFocus(index)}
              keyboardType="numeric"
              maxLength={1}
              selectTextOnFocus
              selection={handleTextInputSelection(index)}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="oneTimeCode"
              returnKeyType="done"
            />
          );
        })}
      </View>
      {error && (
        <Text style={[styles.errorText, {color: theme.colors.dangerText}]}>
          {error}
        </Text>
      )}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
      alignItems: 'center',
      marginVertical: theme.spacing['5'],
    },
    inputContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      width: '100%',
      gap: theme.spacing['2'],
      paddingHorizontal: theme.spacing['2.5'],
    },
    input: {
      flex: 1,
      maxWidth: 50,
      height: 60,
      borderWidth: 1.5,
      borderRadius: 14,
      textAlign: 'center',
      ...theme.typography.h4,
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 28,
      ...(Platform.OS === 'android'
        ? {textAlignVertical: 'center', includeFontPadding: false}
        : {includeFontPadding: false}),
    },
    inputActive: {
      boxShadow: `0px 0px 0px 4px ${theme.colors.blueSoft}`,
    },
    errorText: {
      marginTop: theme.spacing['3'],
      ...theme.typography.bodySmall,
      textAlign: 'center',
      fontWeight: '500',
    },
  });
