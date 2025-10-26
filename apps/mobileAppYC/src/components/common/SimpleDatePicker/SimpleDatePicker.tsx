import { useState, useEffect } from 'react';
import { Platform, Modal, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface SimpleDatePickerProps {
  /** The current value of the date picker */
  value: Date | null;

  /** Callback when the user confirms a date (on Android auto-triggers) */
  onDateChange: (date: Date) => void;

  /** Whether the picker should be shown */
  show: boolean;

  /** Callback when the picker should be closed */
  onDismiss: () => void;

  /** Earliest selectable date */
  minimumDate?: Date;

  /** Latest selectable date */
  maximumDate?: Date;

  /** Picker mode (defaults to 'date') */
  mode?: 'date' | 'time' | 'datetime';
}

export const SimpleDatePicker: React.FC<SimpleDatePickerProps> = ({
  value,
  onDateChange,
  show,
  onDismiss,
  minimumDate,
  maximumDate,
  mode = 'date',
}) => {
  const [selectedDate, setSelectedDate] = useState(value || new Date());

  useEffect(() => {
    if (value) {
      setSelectedDate(value);
    }
  }, [value]);

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      // Android auto-closes
      if (event.type === 'set' && date) {
        onDateChange(date);
      }
      onDismiss();
    } else if (date) {
      // iOS - just update the internal state
      setSelectedDate(date);
    }
  };

  const handleIOSConfirm = () => {
    onDateChange(selectedDate);
    onDismiss();
  };

  const handleIOSCancel = () => {
    setSelectedDate(value || new Date());
    onDismiss();
  };

  if (!show) return null;

  // Android: render picker directly (it shows in a dialog)
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={selectedDate}
        mode={mode}
        display="default"
        onChange={handleDateChange}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
      />
    );
  }

  // iOS: wrap in a modal with confirm/cancel buttons
  return (
    <Modal
      transparent
      animationType="slide"
      visible={show}
      onRequestClose={handleIOSCancel}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={handleIOSCancel}
      >
        <View style={styles.pickerContainer}>
          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={handleIOSCancel} style={styles.button}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleIOSConfirm} style={styles.button}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Date Picker */}
          <View style={styles.pickerWrapper}>
            <DateTimePicker
              value={selectedDate}
              mode={mode}
              display="spinner"
              onChange={handleDateChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              {...(Platform.OS === 'ios' ? { textColor: '#FFFFFF' } : {})}
            />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // Account for iOS safe area
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  button: {
    padding: 8,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '400',
  },
  doneButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  pickerWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  picker: {
    width: '100%',
    height: 216, // Standard iOS picker height
  },
});

// Utility function remains the same
export const formatDateForDisplay = (date: Date | null): string => {
  if (!date) return '';

  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(dateObj.getTime())) return '';

    const months = [
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
    ];

    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();

    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
};
