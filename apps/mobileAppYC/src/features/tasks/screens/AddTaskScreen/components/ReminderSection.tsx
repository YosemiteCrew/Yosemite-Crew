import React from 'react';
import {View, Text} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {Toggle} from '@/shared/components/common';
import {createFormStyles} from '@/shared/utils/formStyles';
import type {TaskFormData, ReminderOption} from '@/features/tasks/types';

interface ReminderSectionProps {
  formData: TaskFormData;
  updateField: <K extends keyof TaskFormData>(
    field: K,
    value: TaskFormData[K],
  ) => void;
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
        <Toggle
          value={formData.reminderEnabled}
          onValueChange={value => updateField('reminderEnabled', value)}
          accessibilityLabel="Reminder"
        />
      </View>

      {formData.reminderEnabled && (
        <View style={formStyles.reminderPillsContainer}>
          {reminderOptions.map(option => {
            const isSelected = formData.reminderOptions === option;
            return (
              <PressableOpacity
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
                }}
                accessibilityRole="radio"
                accessibilityState={{selected: isSelected}}
                accessibilityLabel={option}>
                <Text
                  style={[
                    formStyles.reminderPillText,
                    isSelected && formStyles.reminderPillTextSelected,
                  ]}>
                  {option}
                </Text>
              </PressableOpacity>
            );
          })}
        </View>
      )}
    </>
  );
};
