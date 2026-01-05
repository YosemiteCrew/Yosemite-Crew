import { useState, useEffect } from 'react';
import { Platform, Modal, View, StyleSheet, TouchableOpacity, Text, useColorScheme } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks';

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
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const {theme} = useTheme();

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
      return;
    }

    // On iOS, just update the temp date
    if (selectedDate) {
      setTempDate(selectedDate);
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

  const sheetBackground = isDarkMode ? theme.colors.secondary : theme.colors.white;
  const dividerColor = isDarkMode ? theme.colors.borderMuted : theme.colors.black;
  const overlayColor = theme.colors.overlay;
  const primaryTextColor = theme.colors.primary;
  const pickerTextColor = isDarkMode ? theme.colors.white : theme.colors.black;

  const styles = createStyles(theme);

  // iOS needs a modal container
  if (Platform.OS === 'ios') {
    return (
      <Modal
        transparent
        animationType="slide"
        visible={internalShow}
        onRequestClose={handleCancel}
      >
        <View style={[styles.modalOverlay, {backgroundColor: overlayColor}]}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={handleCancel}
          />
          <View style={[styles.modalContent, {backgroundColor: sheetBackground}]}>
            <View style={[styles.header, {borderBottomColor: dividerColor, backgroundColor: sheetBackground}]}>
              <TouchableOpacity onPress={handleCancel} style={styles.button}>
                <Text style={[styles.buttonText, {color: primaryTextColor}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} style={styles.button}>
                <Text style={[styles.buttonText, styles.confirmText, {color: primaryTextColor}]}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode={mode}
              display="spinner"
              onChange={handleDateChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              themeVariant={isDarkMode ? 'dark' : 'light'}
              textColor={pickerTextColor}
              style={[styles.picker, {backgroundColor: sheetBackground}]}
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

const createStyles = (theme: any) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.colors.overlay,
    },
    modalBackdrop: {
      flex: 1,
    },
    modalContent: {
      backgroundColor: theme.colors.white,
      borderTopLeftRadius: theme.borderRadius.lg,
      borderTopRightRadius: theme.borderRadius.lg,
      paddingBottom: theme.spacing['9'] || 34,
      alignItems: 'center',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing['4'],
      paddingVertical: theme.spacing['3'],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.white,
      width: '100%',
    },
    button: {
      padding: theme.spacing['2'],
      minWidth: theme.spacing['15'] || 60,
    },
    buttonText: {
      ...theme.typography.paragraph,
      color: theme.colors.primary,
      textAlign: 'center',
    },
    confirmText: {
      fontWeight: '600',
    },
    picker: {
      height: theme.spacing['54'] || 216,
      width: '100%',
      backgroundColor: theme.colors.white,
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
