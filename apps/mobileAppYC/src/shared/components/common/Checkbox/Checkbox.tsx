// src/components/common/Checkbox/Checkbox.tsx
import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  TextStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '@/hooks';

interface CheckboxProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: React.ReactNode;
  error?: string;
  labelStyle?: StyleProp<TextStyle>;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  value,
  onValueChange,
  label,
  error,
  labelStyle,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => onValueChange(!value)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkbox,
            value && styles.checkboxChecked,
            error && styles.checkboxError,
          ]}
        >
          {value && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </View>
        {label ? (
          <Text style={[styles.label, labelStyle as any]}>{label}</Text>
        ) : null}
      </TouchableOpacity>
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      marginBottom: 8,
    },
    checkboxContainer: {
  flexDirection: 'row',
  alignItems: 'flex-start',
    },
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: theme.colors.border,
      borderRadius: 4,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    checkboxChecked: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    checkboxError: {
      borderColor: theme.colors.error,
    },
    checkmark: {
      color: theme.colors.white,
      fontSize: 12,
      fontWeight: 'bold',
    },
    label: {
      ...theme.typography.paragraph,
      color: theme.colors.text,
      flex: 1,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 12,
      marginTop: 4,
      marginLeft: 28,
    },
  });
