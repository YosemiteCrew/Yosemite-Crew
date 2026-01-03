// src/components/common/Checkbox/Checkbox.tsx
import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  TextStyle,
  StyleProp,
  Image,
} from 'react-native';
import {useTheme} from '@/hooks';
import {Images} from '@/assets/images';

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
  const checkboxIcon = value ? Images.checkFill : Images.checkEmpty;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => onValueChange(!value)}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{checked: value}}
        accessibilityHint={typeof label === 'string' ? label : undefined}
      >
        <View style={[styles.checkboxWrapper, error && styles.checkboxError]}>
          <Image source={checkboxIcon} style={styles.checkboxIcon} />
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
      marginBottom: theme.spacing['2'],
    },
    checkboxContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkboxWrapper: {
      width: theme.spacing['6'],
      height: theme.spacing['6'],
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing['2'],
      borderRadius: theme.borderRadius.xs,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    checkboxIcon: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    checkboxError: {
      borderColor: theme.colors.error,
    },
    label: {
      ...theme.typography.paragraph,
      color: theme.colors.text,
      flex: 1,
    },
    errorText: {
      color: theme.colors.error,
      ...theme.typography.bodySmall,
      marginTop: theme.spacing['1'],
      marginLeft: theme.spacing['7'],
    },
  });
