import React from 'react';
import {View, StyleSheet, Image} from 'react-native';
import {Input, TouchableInput} from '@/components/common';
import {formatDateForDisplay} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import {Images} from '@/assets/images';
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
  const styles = React.useMemo(() => createStyles(theme), [theme]);
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

      {/* Date and Time in Single Row */}
      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeField}>
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

        <View style={styles.dateTimeField}>
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
      </View>

      {/* Task Frequency */}
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
      marginBottom: theme.spacing[6],
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: theme.spacing[3],
      marginBottom: theme.spacing[6],
    },
    dateTimeField: {
      flex: 1,
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
