import React from 'react';
import {View, StyleSheet, Text, Switch, TouchableOpacity} from 'react-native';
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
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <View style={styles.toggleSection}>
        <Text style={styles.toggleLabel}>Reminder</Text>
        <Switch
          value={formData.reminderEnabled}
          onValueChange={value => updateField('reminderEnabled', value)}
          trackColor={{false: theme.colors.borderMuted, true: theme.colors.primary}}
          thumbColor={theme.colors.white}
        />
      </View>

      {formData.reminderEnabled && (
        <View style={styles.reminderPillsContainer}>
          {reminderOptions.map(option => {
            const isSelected = formData.reminderOptions === option;
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.reminderPill,
                  isSelected && styles.reminderPillSelected,
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
                    styles.reminderPillText,
                    isSelected && styles.reminderPillTextSelected,
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

const createStyles = (theme: any) =>
  StyleSheet.create({
    toggleSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing[4],
      marginBottom: theme.spacing[2],
    },
    toggleLabel: {
      ...theme.typography.bodyMedium,
      color: theme.colors.secondary,
      fontWeight: '500',
    },
    reminderPillsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing[2],
      marginBottom: theme.spacing[4],
    },
    reminderPill: {
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[3],
      backgroundColor: theme.colors.surface,
      borderRadius: 28,
      borderWidth: 0.5,
      borderColor: '#312943',
    },
    reminderPillSelected: {
      backgroundColor: theme.colors.lightBlueBackground,
      borderColor: theme.colors.primary,
    },
    reminderPillText: {
      ...theme.typography.bodySmall,
      color: theme.colors.secondary,
      fontWeight: '500',
    },
    reminderPillTextSelected: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
  });
