// src/components/common/DatePicker/DatePicker.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../../hooks';

interface DatePickerProps {
  value?: Date;
  onDateChange: (date: Date) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  mode?: 'date' | 'time' | 'datetime';
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onDateChange,
  label,
  placeholder = 'Select date',
  error,
  minimumDate,
  maximumDate,
  mode = 'date',
}) => {
  const { theme } = useTheme();
  const [show, setShow] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShow(Platform.OS === 'ios');
    if (selectedDate) {
      onDateChange(selectedDate);
    }
  };

  const showDatePicker = () => {
    setShow(true);
  };

  const formatDate = (date: Date) => {
    if (mode === 'time') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (mode === 'datetime') {
      return date.toLocaleString();
    }
    return date.toLocaleDateString();
  };

  const getDisplayText = () => {
    if (value) {
      return formatDate(value);
    }
    return placeholder;
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: theme.colors.text }]}>
          {label}
        </Text>
      )}
      
      <TouchableOpacity
        style={[
          styles.input,
          {
            borderColor: error ? theme.colors.error : theme.colors.border,
            // backgroundColor: theme.colors.inputBackground,
          }
        ]}
        onPress={showDatePicker}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.inputText,
            {
              color: value ? theme.colors.text : theme.colors.textSecondary,
            }
          ]}
        >
          {getDisplayText()}
        </Text>
        <Text style={[styles.calendar, { color: theme.colors.textSecondary }]}>
          📅
        </Text>
      </TouchableOpacity>

      {error && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      )}

      {show && (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  inputText: {
    fontSize: 16,
    flex: 1,
  },
  calendar: {
    fontSize: 18,
  },
  errorText: {
    marginTop: 4,
    fontSize: 14,
  },
});