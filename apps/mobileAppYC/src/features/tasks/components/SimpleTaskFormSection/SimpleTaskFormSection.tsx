import React from 'react';
import {View} from 'react-native';
import {Input} from '@/shared/components/common';
import {createTaskFormSectionStyles} from '@/features/tasks/components/shared/taskFormStyles';
import {TaskFormFields} from '@/features/tasks/components/shared/TaskFormFields';
import type {TaskFormData, TaskFormErrors, TaskTypeSelection} from '@/features/tasks/types';

interface SimpleTaskFormSectionProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  taskTypeSelection?: TaskTypeSelection;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  onOpenDatePicker: () => void;
  onOpenTimePicker: () => void;
  onOpenTaskFrequencySheet: () => void;
  theme: any;
}

export const SimpleTaskFormSection: React.FC<SimpleTaskFormSectionProps> = ({
  formData,
  errors,
  taskTypeSelection,
  updateField,
  onOpenDatePicker,
  onOpenTimePicker,
  onOpenTaskFrequencySheet,
  theme,
}) => {
  const styles = React.useMemo(() => createTaskFormSectionStyles(theme), [theme]);
  const isEditable = !taskTypeSelection || taskTypeSelection.category === 'custom';
  const placeholderText = isEditable ? 'Enter task name' : undefined;

  return (
    <>
      {/* Task Name */}
      <View style={styles.fieldGroup}>
        <Input
          label="Task name"
          value={formData.title}
          onChangeText={text => updateField('title', text)}
          error={errors.title}
          editable={isEditable}
          placeholder={placeholderText}
        />
      </View>

      {/* Task Description */}
      <View style={styles.fieldGroup}>
        <Input
          label="Task description (optional)"
          value={formData.description}
          onChangeText={text => updateField('description', text)}
          multiline
          numberOfLines={3}
          inputStyle={styles.textArea}
        />
      </View>

      <TaskFormFields
        formData={{date: formData.date, time: formData.time, frequency: formData.frequency}}
        errors={{date: errors.date, time: errors.time, frequency: errors.frequency}}
        updateField={updateField}
        onOpenDatePicker={onOpenDatePicker}
        onOpenTimePicker={onOpenTimePicker}
        onOpenTaskFrequencySheet={onOpenTaskFrequencySheet}
        theme={theme}
      />
    </>
  );
};
