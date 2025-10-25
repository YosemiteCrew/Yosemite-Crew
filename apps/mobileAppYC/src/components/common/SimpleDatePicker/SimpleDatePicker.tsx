import { useState, useEffect } from 'react';
import { Platform, Modal, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface SimpleDatePickerProps {
  value: Date | null;
  onDateChange: (date: Date) => void;
  show: boolean;
  onDismiss: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
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
  const [internalShow, setInternalShow] = useState(show);
  const [tempDate, setTempDate] = useState(value || new Date());

  useEffect(() => {
    setInternalShow(show);
    if (show) {
      setTempDate(value || new Date());
    }
  }, [show, value]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    // On Android, the picker closes automatically
    if (Platform.OS === 'android') {
      setInternalShow(false);
      onDismiss();

      // If user selected a date
      if (event.type === 'set' && selectedDate) {
        onDateChange(selectedDate);
      }
    } else {
      // On iOS, just update the temp date
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    onDateChange(tempDate);
    setInternalShow(false);
    onDismiss();
  };

  const handleCancel = () => {
    setInternalShow(false);
    onDismiss();
  };

  if (!internalShow) {
    return null;
  }

  // iOS needs a modal container
  if (Platform.OS === 'ios') {
    return (
      <Modal
        transparent
        animationType="slide"
        visible={internalShow}
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={handleCancel}
          />
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleCancel} style={styles.button}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} style={styles.button}>
                <Text style={[styles.buttonText, styles.confirmText]}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode={mode}
              display="spinner"
              onChange={handleDateChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              style={styles.picker}
            />
          </View>
        </View>
      </Modal>
    );
  }

  // Android uses default picker
  return (
    <DateTimePicker
      value={value || new Date()}
      mode={mode}
      display="default"
      onChange={handleDateChange}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
    />
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34, // Safe area for iOS
    alignItems: 'center',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38383A',
    backgroundColor: '#1C1C1E',
    width: '100%',
  },
  button: {
    padding: 8,
    minWidth: 60,
  },
  buttonText: {
    fontSize: 17,
    color: '#0A84FF',
    textAlign: 'center',
  },
  confirmText: {
    fontWeight: '600',
  },
  picker: {
    height: 216,
    width: '100%',
    backgroundColor: '#1C1C1E',
  },
});

// Utility function for date formatting
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

// Utility function for time formatting
export const formatTimeForDisplay = (time: Date | null): string => {
  if (!time) return '';

  try {
    const timeObj = time instanceof Date ? time : new Date(time);
    if (Number.isNaN(timeObj.getTime())) return '';

    const minutes = timeObj.getMinutes().toString().padStart(2, '0');
    const ampm = timeObj.getHours() >= 12 ? 'PM' : 'AM';
    const displayHours = (timeObj.getHours() % 12 || 12).toString().padStart(2, '0');

    return `${displayHours}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Time formatting error:', error);
    return '';
  }
};
