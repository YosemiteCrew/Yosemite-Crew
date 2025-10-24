import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
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

  useEffect(() => {
    setInternalShow(show);
  }, [show]);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    // On Android, the picker closes automatically
    if (Platform.OS === 'android') {
      setInternalShow(false);
      onDismiss();
    }

    // If user selected a date
    if (event.type === 'set' && selectedDate) {
      onDateChange(selectedDate);

      // On iOS, close manually after selection
      if (Platform.OS === 'ios') {
        setInternalShow(false);
        onDismiss();
      }
    } else if (event.type === 'dismissed') {
      // User cancelled
      setInternalShow(false);
      onDismiss();
    }
  };

  if (!internalShow) {
    return null;
  }

  return (
    <DateTimePicker
      value={value || new Date()}
      mode={mode}
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      onChange={handleDateChange}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
    />
  );
};

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
