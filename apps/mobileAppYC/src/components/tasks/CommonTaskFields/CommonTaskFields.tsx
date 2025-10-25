import React from 'react';
import {View, StyleSheet, Text, TouchableOpacity} from 'react-native';
import {Input} from '@/components/common';
import type {TaskFormData, TaskFormErrors} from '@/features/tasks/types';

interface CommonTaskFieldsProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  onOpenAssignTaskSheet: () => void;
  theme: any;
}

export const CommonTaskFields: React.FC<CommonTaskFieldsProps> = ({
  formData,
  errors,
  updateField,
  onOpenAssignTaskSheet,
  theme,
}) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      {/* Assign Task Field */}
      <View style={styles.fieldGroup}>
        <TouchableOpacity onPress={onOpenAssignTaskSheet}>
          <Input
            label="Assign to"
            placeholder="Select a team member"
            value={formData.assignedTo ? `User ${formData.assignedTo}` : ''}
            editable={false}
            onChangeText={() => {}}
          />
        </TouchableOpacity>
        {errors.assignedTo && <Text style={styles.errorText}>{errors.assignedTo}</Text>}
      </View>

      {/* Additional Note Field */}
      <View style={styles.fieldGroup}>
        <Input
          label="Additional note"
          placeholder="Add any extra details..."
          value={formData.additionalNote || ''}
          onChangeText={value => updateField('additionalNote', value)}
          multiline
          numberOfLines={3}
        />
        {errors.additionalNote && <Text style={styles.errorText}>{errors.additionalNote}</Text>}
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing[3],
    },
    fieldGroup: {
      gap: theme.spacing[1],
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 12,
      marginTop: theme.spacing[1],
    },
  });
