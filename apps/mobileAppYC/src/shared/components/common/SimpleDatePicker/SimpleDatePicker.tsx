import {useMemo, useState} from 'react';
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

interface IOSPickerModalProps {
  value: Date;
  onDateChange: (date: Date) => void;
  onDismiss: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
  mode: 'date' | 'time' | 'datetime';
}

// Extracted so the draft date reinitializes naturally each time this mounts.
const IOSPickerModal: React.FC<IOSPickerModalProps> = ({
  value,
  onDateChange,
  onDismiss,
  minimumDate,
  maximumDate,
  mode,
}) => {
  const [iosDraftDate, setIosDraftDate] = useState(() => value);
  const {t} = useTranslation();
  const {theme} = useTheme();
  const isTimeMode = mode === 'time';

  const iosActionTextColor = useMemo(() => PlatformColor('systemBlue'), []);
  const iosBackgroundColor = useMemo(
    () => PlatformColor('systemBackground'),
    [],
  );
  const iosPillBackgroundColor = useMemo(
    () => PlatformColor('secondarySystemBackground'),
    [],
  );
  const useNativeGlass = isLiquidGlassSupported;

  const confirmValue = () => {
    onDateChange(iosDraftDate);
    onDismiss();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (event?.type === 'dismissed') {
      onDismiss();
      return;
    }
    if (selectedDate) {
      setIosDraftDate(selectedDate);
    }
  };

  const buildActionButton = (
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
    <Modal animationType="fade" transparent visible onRequestClose={onDismiss}>
      <View style={styles.modalRoot}>
        <Pressable
          testID="ios-datetime-picker-backdrop"
          style={styles.backdrop}
          onPress={onDismiss}
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
            {buildActionButton(
              'ios-datetime-picker-cancel',
              'common.cancel',
              onDismiss,
            )}
            {buildActionButton(
              'ios-datetime-picker-done',
              'common.done',
              confirmValue,
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const SimpleDatePicker: React.FC<SimpleDatePickerProps> = ({
  value,
  onDateChange,
  show,
  onDismiss,
  minimumDate,
  maximumDate,
  mode = 'date',
}) => {
  const isIOS = Platform.OS === 'ios';
  const fallbackDate = useMemo(() => new Date(), []);

  if (!show) {
    return null;
  }

  if (isIOS) {
    const pickerKey = value?.getTime() ?? 'empty';

    return (
      <IOSPickerModal
        key={pickerKey}
        value={value ?? fallbackDate}
        onDateChange={onDateChange}
        onDismiss={onDismiss}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        mode={mode}
      />
    );
  }

  const handleAndroidDateChange = (event: any, selectedDate?: Date) => {
    const eventType = event?.type;

    if (eventType === 'dismissed') {
      onDismiss();
      return;
    }

    if (selectedDate && eventType === 'set') {
      onDateChange(selectedDate);
    }
    onDismiss();
  };

  return (
    <DateTimePicker
      value={value || fallbackDate}
      mode={mode}
      display="default"
      onChange={handleAndroidDateChange}
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
