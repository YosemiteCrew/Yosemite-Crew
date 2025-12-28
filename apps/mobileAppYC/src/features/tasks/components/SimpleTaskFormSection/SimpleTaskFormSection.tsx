import React, {useMemo} from 'react';
import {View, Image} from 'react-native';
import {Input, TouchableInput} from '@/shared/components/common';
import CalendarMonthStrip from '@/features/appointments/components/CalendarMonthStrip/CalendarMonthStrip';
import {formatTimeForDisplay} from '@/shared/utils/timeHelpers';
import {formatDateToISODate} from '@/shared/utils/dateHelpers';
import {Images} from '@/assets/images';
import {createIconStyles} from '@/shared/utils/iconStyles';
import {createTaskFormSectionStyles} from '@/features/tasks/components/shared/taskFormStyles';
import type {TaskFormData, TaskFormErrors, TaskTypeSelection} from '@/features/tasks/types';

interface SimpleTaskFormSectionProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  taskTypeSelection?: TaskTypeSelection;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  onOpenTimePicker: () => void;
  onOpenTaskFrequencySheet: () => void;
  theme: any;
}

export const SimpleTaskFormSection: React.FC<SimpleTaskFormSectionProps> = ({
  formData,
  errors,
  taskTypeSelection,
  updateField,
  onOpenTimePicker,
  onOpenTaskFrequencySheet,
  theme,
}) => {
  const styles = React.useMemo(() => createTaskFormSectionStyles(theme), [theme]);
  const iconStyles = React.useMemo(() => createIconStyles(theme), [theme]);
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

      {/* Date Picker */}
      <View style={styles.fieldGroup}>
        <CalendarMonthStrip
          selectedDate={formData.date}
          onChange={(date: Date) => updateField('date', date)}
        />
      </View>

      {/* Time */}
      <View style={styles.fieldGroup}>
        <TouchableInput
          label={formData.time ? 'Time' : undefined}
          value={formatTimeForDisplay(formData.time)}
          placeholder="Time"
          onPress={onOpenTimePicker}
          rightComponent={<Image source={Images.clockIcon} style={styles.calendarIcon} />}
          error={errors.time}
        />
      </View>

      {/* Task Frequency */}
      <View style={styles.fieldGroup}>
        <TouchableInput
          label={formData.frequency ? 'Task frequency' : undefined}
          value={formData.frequency || undefined}
          placeholder="Task frequency"
          onPress={onOpenTaskFrequencySheet}
          rightComponent={
            <Image source={Images.dropdownIcon} style={iconStyles.dropdownIcon} />
          }
          error={errors.frequency}
        />
      </View>
    </>
  );
};
