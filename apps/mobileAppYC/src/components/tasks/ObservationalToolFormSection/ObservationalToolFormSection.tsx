import React from 'react';
import {View, StyleSheet, Image} from 'react-native';
import {Input, TouchableInput} from '@/components/common';
import {formatDateForDisplay} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import {Images} from '@/assets/images';
import type {TaskFormData, TaskFormErrors} from '@/features/tasks/types';

interface ObservationalToolFormSectionProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  onOpenObservationalToolSheet: () => void;
  onOpenDatePicker: () => void;
  onOpenTimePicker: () => void;
  onOpenTaskFrequencySheet: () => void;
  theme: any;
}

export const ObservationalToolFormSection: React.FC<ObservationalToolFormSectionProps> = ({
  formData,
  errors,
  updateField,
  onOpenObservationalToolSheet,
  onOpenDatePicker,
  onOpenTimePicker,
  onOpenTaskFrequencySheet,
  theme,
}) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

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
          value={formData.observationalTool || undefined}
          placeholder="Select observational tool"
          onPress={onOpenObservationalToolSheet}
          rightComponent={
            <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
          }
          error={errors.observationalTool}
        />
      </View>

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
          value={
            formData.time
              ? formData.time.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })
              : undefined
          }
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
            <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
          }
          error={errors.frequency}
        />
      </View>
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    fieldGroup: {
      marginBottom: theme.spacing[4],
    },
    dropdownIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
    calendarIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
    },
  });
