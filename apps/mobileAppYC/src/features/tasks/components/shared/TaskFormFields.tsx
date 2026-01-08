import React from 'react';
import {View, Image} from 'react-native';
import {TouchableInput} from '@/shared/components/common';
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';
import {formatTimeForDisplay} from '@/shared/utils/timeHelpers';
import {Images} from '@/assets/images';
import {createIconStyles} from '@/shared/utils/iconStyles';
import {createTaskFormSectionStyles} from '@/features/tasks/components/shared/taskFormStyles';
import type {TaskFrequency} from '@/features/tasks/types';

interface TaskFormFieldsProps {
  formData: {
    date: Date | null;
    time: Date | null;
    frequency: TaskFrequency | null;
  };
  errors: {
    date?: string;
    time?: string;
    frequency?: string;
  };
  onOpenDatePicker: () => void;
  onOpenTimePicker: () => void;
  onOpenTaskFrequencySheet: () => void;
  theme: any;
}

export const TaskFormFields: React.FC<TaskFormFieldsProps> = ({
  formData,
  errors,
  onOpenDatePicker,
  onOpenTimePicker,
  onOpenTaskFrequencySheet,
  theme,
}) => {
  const styles = React.useMemo(() => createTaskFormSectionStyles(theme), [theme]);
  const iconStyles = React.useMemo(() => createIconStyles(theme), [theme]);

  return (
    <>
      <View style={styles.fieldGroup}>
        <TouchableInput
          label={formData.date ? 'Date' : undefined}
          value={formData.date ? formatDateForDisplay(formData.date) : undefined}
          placeholder="Date"
          onPress={onOpenDatePicker}
          rightComponent={
            <Image source={Images.calendarIcon} style={styles.calendarIcon} />
          }
          error={errors.date}
        />
      </View>

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
