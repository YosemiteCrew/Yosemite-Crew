import React from 'react';
import {View, Text, Switch, Image, Platform} from 'react-native';
import {TouchableInput} from '@/shared/components/common';
import {Images} from '@/assets/images';
import {createIconStyles} from '@/shared/utils/iconStyles';
import {createFormStyles} from '@/shared/utils/formStyles';
import type {TaskFormData} from '@/features/tasks/types';

interface CalendarSyncSectionProps {
  formData: TaskFormData;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  onOpenCalendarSyncSheet: () => void;
  theme: any;
}

export const CalendarSyncSection: React.FC<CalendarSyncSectionProps> = ({
  formData,
  updateField,
  onOpenCalendarSyncSheet,
  theme,
}) => {
  const iconStyles = React.useMemo(() => createIconStyles(theme), [theme]);
  const formStyles = React.useMemo(() => createFormStyles(theme), [theme]); // Used in JSX below

  // Platform-specific default placeholder
  const defaultPlaceholder = Platform.OS === 'ios' ? 'iCloud Calendar' : 'Google Calendar';

  return (
    <>
      <View style={formStyles.toggleSection}>
        <Text style={formStyles.toggleLabel}>Sync with Calendar</Text>
        <Switch
          value={formData.syncWithCalendar}
          onValueChange={value => updateField('syncWithCalendar', value)}
          trackColor={{false: theme.colors.borderMuted, true: theme.colors.primary}}
          thumbColor={theme.colors.white}
        />
      </View>

      {formData.syncWithCalendar && (
        <View style={formStyles.fieldGroup}>
          <TouchableInput
            label={formData.calendarProviderName ? 'Calendar provider' : undefined}
            value={formData.calendarProviderName || undefined}
            placeholder={defaultPlaceholder}
            onPress={onOpenCalendarSyncSheet}
            rightComponent={
              <Image source={Images.dropdownIcon} style={iconStyles.dropdownIcon} />
            }
          />
        </View>
      )}
    </>
  );
};
