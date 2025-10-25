import React from 'react';
import {View, StyleSheet, Text, Switch, Image} from 'react-native';
import {TouchableInput} from '@/components/common';
import {Images} from '@/assets/images';
import type {TaskFormData} from '@/features/tasks/types';

interface CalendarSyncSectionProps {
  formData: TaskFormData;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  onOpenCalendarSyncSheet: () => void;
  theme: any;
}

const formatCalendarProvider = (provider: 'google' | 'icloud' | null): string | undefined => {
  if (provider === 'google') {
    return 'Google Calendar';
  }
  if (provider === 'icloud') {
    return 'iCloud Calendar';
  }
  return undefined;
};

export const CalendarSyncSection: React.FC<CalendarSyncSectionProps> = ({
  formData,
  updateField,
  onOpenCalendarSyncSheet,
  theme,
}) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <View style={styles.toggleSection}>
        <Text style={styles.toggleLabel}>Sync with Calendar</Text>
        <Switch
          value={formData.syncWithCalendar}
          onValueChange={value => updateField('syncWithCalendar', value)}
          trackColor={{false: theme.colors.borderMuted, true: theme.colors.primary}}
          thumbColor={theme.colors.white}
        />
      </View>

      {formData.syncWithCalendar && (
        <View style={styles.fieldGroup}>
          <TouchableInput
            label={formData.calendarProvider ? 'Calendar provider' : undefined}
            value={formatCalendarProvider(formData.calendarProvider)}
            placeholder="Select calendar provider"
            onPress={onOpenCalendarSyncSheet}
            rightComponent={
              <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
            }
          />
        </View>
      )}
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    toggleSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing[4],
    },
    toggleLabel: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
      fontWeight: '500',
    },
    fieldGroup: {
      marginBottom: theme.spacing[4],
    },
    dropdownIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
  });
