import React from 'react';
import {View, Image} from 'react-native';
import {Input, TouchableInput} from '@/shared/components/common';
import {Images} from '@/assets/images';
import {createIconStyles} from '@/shared/utils/iconStyles';
import {createTaskFormSectionStyles} from '@/features/tasks/components/shared/taskFormStyles';
import {TaskFormFields} from '@/features/tasks/components/shared/TaskFormFields';
import type {TaskFormData, TaskFormErrors} from '@/features/tasks/types';
import {resolveObservationalToolLabel} from '@/features/tasks/utils/taskLabels';

interface ObservationalToolFormSectionProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  onOpenObservationalToolSheet: () => void;
  onOpenTimePicker: () => void;
  onOpenTaskFrequencySheet: () => void;
  theme: any;
}

export const ObservationalToolFormSection: React.FC<ObservationalToolFormSectionProps> = ({
  formData,
  errors,
  updateField,
  onOpenObservationalToolSheet,
  onOpenTimePicker,
  onOpenTaskFrequencySheet,
  theme,
}) => {
  const styles = React.useMemo(() => createTaskFormSectionStyles(theme), [theme]);
  const iconStyles = React.useMemo(() => createIconStyles(theme), [theme]);
  const observationalToolLabel = formData.observationalTool
    ? resolveObservationalToolLabel(formData.observationalTool)
    : undefined;

  return (
    <>
      {/* Task Name */}
      <View style={styles.fieldGroup}>
        <Input
          label="Task name"
          value={formData.title}
          onChangeText={text => updateField('title', text)}
          error={errors.title}
          editable={false}
        />
      </View>

      <View style={styles.fieldGroup}>
        <TouchableInput
          label={formData.observationalTool ? 'Select observational tool' : undefined}
          value={observationalToolLabel}
          placeholder="Select observational tool"
          onPress={onOpenObservationalToolSheet}
          rightComponent={
            <Image source={Images.dropdownIcon} style={iconStyles.dropdownIcon} />
          }
          error={errors.observationalTool}
        />
      </View>

      <TaskFormFields
        formData={{date: formData.date, time: formData.time, frequency: formData.frequency}}
        errors={{time: errors.time, frequency: errors.frequency}}
        updateField={updateField}
        onOpenTimePicker={onOpenTimePicker}
        onOpenTaskFrequencySheet={onOpenTaskFrequencySheet}
        theme={theme}
      />
    </>
  );
};
