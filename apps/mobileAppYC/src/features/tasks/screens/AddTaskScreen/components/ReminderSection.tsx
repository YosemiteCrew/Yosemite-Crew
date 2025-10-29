import React from 'react';
import {View, Text, Switch, TouchableOpacity} from 'react-native';
import {createFormStyles} from '@/shared/utils/formStyles';
import type {TaskFormData, ReminderOption} from '@/features/tasks/types';

interface ReminderSectionProps {
  formData: TaskFormData;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  reminderOptions: ReminderOption[];
  theme: any;
}

export const ReminderSection: React.FC<ReminderSectionProps> = ({
  formData,
  updateField,
  reminderOptions,
  theme,
}) => {
  const formStyles = React.useMemo(() => createFormStyles(theme), [theme]);

  return (
    <>
      <View style={formStyles.toggleSection}>
        <Text style={formStyles.toggleLabel}>Reminder</Text>
        <Switch
          value={formData.reminderEnabled}
          onValueChange={value => updateField('reminderEnabled', value)}
          trackColor={{false: theme.colors.borderMuted, true: theme.colors.primary}}
          thumbColor={theme.colors.white}
        />
      </View>

      {formData.reminderEnabled && (
        <View style={formStyles.reminderPillsContainer}>
          {reminderOptions.map(option => {
            const isSelected = formData.reminderOptions === option;
            return (
              <TouchableOpacity
                key={option}
                style={[
                  formStyles.reminderPill,
                  isSelected && formStyles.reminderPillSelected,
                ]}
                onPress={() => {
                  if (isSelected) {
                    updateField('reminderOptions', null);
                  } else {
                    updateField('reminderOptions', option);
                  }
                }}>
                <Text
                  style={[
                    formStyles.reminderPillText,
                    isSelected && formStyles.reminderPillTextSelected,
                  ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </>
  );
};
