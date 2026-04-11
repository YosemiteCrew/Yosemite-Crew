import {useEffect, useMemo, useState} from 'react';
import {
  Modal,
  Platform,
  PlatformColor,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {LiquidGlassView, isLiquidGlassSupported} from '@callstack/liquid-glass';
import {useTranslation} from 'react-i18next';
import {useTheme} from '@/hooks';

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
  const [iosDraftDate, setIosDraftDate] = useState(value ?? new Date());
  const {t} = useTranslation();
  const {theme} = useTheme();
  const isIOS = Platform.OS === 'ios';

  useEffect(() => {
    setInternalShow(show);
  }, [show]);

  useEffect(() => {
    if (show) {
      setIosDraftDate(value ?? new Date());
    }
  }, [show, value]);

  const iosActionTextColor = useMemo(
    () => (isIOS ? PlatformColor('systemBlue') : '#007AFF'),
    [isIOS],
  );
  const iosBackgroundColor = useMemo(
    () => (isIOS ? PlatformColor('systemBackground') : '#FFFFFF'),
    [isIOS],
  );
  const iosPillBackgroundColor = useMemo(
    () => (isIOS ? PlatformColor('secondarySystemBackground') : '#F2F2F7'),
    [isIOS],
  );
  const useNativeGlass = isIOS && isLiquidGlassSupported;

  const dismissPicker = () => {
    setInternalShow(false);
    onDismiss();
  };
  const isTimeMode = mode === 'time';

  const confirmIOSValue = () => {
    onDateChange(iosDraftDate);
    dismissPicker();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const eventType = event?.type;

    if (eventType === 'dismissed') {
      dismissPicker();
      return;
    }

    if (isIOS) {
      if (selectedDate) {
        setIosDraftDate(selectedDate);
      }
      return;
    }

    if (selectedDate && eventType === 'set') {
      onDateChange(selectedDate);
    }
    dismissPicker();
  };

  if (!internalShow) {
    return null;
  }

  if (isIOS) {
    const renderActionButton = (
      testID: string,
      labelKey: 'common.cancel' | 'common.done',
      onPress: () => void,
    ) => (
      <Pressable
        accessibilityRole="button"
        testID={testID}
        onPress={onPress}
        style={styles.actionPressable}>
        {useNativeGlass ? (
          <LiquidGlassView
            style={styles.actionPill}
            interactive={false}
            effect="regular">
            <Text style={[styles.actionText, {color: iosActionTextColor}]}>
              {t(labelKey)}
            </Text>
          </LiquidGlassView>
        ) : (
          <View
            style={[
              styles.actionPill,
              {backgroundColor: iosPillBackgroundColor},
            ]}>
            <Text style={[styles.actionText, {color: iosActionTextColor}]}>
              {t(labelKey)}
            </Text>
          </View>
        )}
      </Pressable>
    );

    return (
      <Modal
        animationType="fade"
        transparent
        visible={internalShow}
        onRequestClose={dismissPicker}>
        <View style={styles.modalRoot}>
          <Pressable
            testID="ios-datetime-picker-backdrop"
            style={styles.backdrop}
            onPress={dismissPicker}
          />
          <View
            style={[
              styles.iosDialog,
              {
                backgroundColor: iosBackgroundColor,
                borderRadius: theme.borderRadius.lg,
              },
            ]}>
            <DateTimePicker
              value={iosDraftDate}
              mode={mode}
              display="spinner"
              onChange={handleDateChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              locale={isTimeMode ? 'en-US' : undefined}
              style={styles.iosPicker}
            />
            <View style={styles.actionFloatingRow}>
              {renderActionButton(
                'ios-datetime-picker-cancel',
                'common.cancel',
                dismissPicker,
              )}
              {renderActionButton(
                'ios-datetime-picker-done',
                'common.done',
                confirmIOSValue,
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  }

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
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  iosDialog: {
    borderRadius: 16,
    maxWidth: 360,
    overflow: 'hidden',
    paddingBottom: 76,
    paddingHorizontal: 12,
    paddingTop: 16,
    width: '90%',
  },
  iosPicker: {
    width: '100%',
  },
  actionFloatingRow: {
    alignItems: 'center',
    bottom: 16,
    columnGap: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    left: 12,
    position: 'absolute',
    right: 12,
  },
  actionPressable: {
    flex: 1,
  },
  actionPill: {
    borderRadius: 999,
    minHeight: 44,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

// Utility function for date formatting
export const formatDateForDisplay = (date: Date | null): string => {
  if (!date) return '';

  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(dateObj.getTime())) return '';

    const months = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
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
    const displayHours = (timeObj.getHours() % 12 || 12)
      .toString()
      .padStart(2, '0');

    return `${displayHours}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Time formatting error:', error);
    return '';
  }
};
