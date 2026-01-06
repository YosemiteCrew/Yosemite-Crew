import React from 'react';
import {View, StyleSheet, Image, TouchableOpacity, Text} from 'react-native';
import {Input, TouchableInput} from '@/shared/components/common';
import CalendarMonthStrip from '@/features/appointments/components/CalendarMonthStrip/CalendarMonthStrip';
import {Images} from '@/assets/images';
import {createIconStyles} from '@/shared/utils/iconStyles';
import {createTaskFormSectionStyles} from '@/features/tasks/components/shared/taskFormStyles';
import type {TaskFormData, TaskFormErrors} from '@/features/tasks/types';

interface MedicationFormSectionProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  onOpenMedicationTypeSheet: () => void;
  onOpenDosageSheet: () => void;
  onOpenMedicationFrequencySheet: () => void;
  theme: any;
  showDosageDisplay?: boolean;
}

const formatDosageText = (dosages: any[]): string | undefined => {
  if (dosages.length === 0) {
    return undefined;
  }
  const pluralSuffix = dosages.length > 1 ? 's' : '';
  return `${dosages.length} dosage${pluralSuffix}`;
};

const formatDosageTime = (timeString: string): string => {
  try {
    let date: Date;
    if (timeString.includes('T')) {
      // ISO format
      date = new Date(timeString);
    } else if (timeString.includes(':')) {
      // Time-only format (HH:mm or HH:mm:ss)
      const [hours, minutes, seconds] = timeString.split(':').map(Number);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return 'Invalid time';
      date = new Date();
      date.setHours(hours, minutes, seconds || 0, 0);
    } else {
      return 'Invalid time';
    }

    if (Number.isNaN(date.getTime())) return 'Invalid time';

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Invalid time';
  }
};

export const MedicationFormSection: React.FC<MedicationFormSectionProps> = ({
  formData,
  errors,
  updateField,
  onOpenMedicationTypeSheet,
  onOpenDosageSheet,
  onOpenMedicationFrequencySheet,
  theme,
  showDosageDisplay = true,
}) => {
  const baseStyles = React.useMemo(() => createTaskFormSectionStyles(theme), [theme]);
  const customStyles = React.useMemo(() => createMedicationStyles(theme), [theme]);
  const styles = React.useMemo(() => ({...baseStyles, ...customStyles}), [baseStyles, customStyles]);
  const iconStyles = React.useMemo(() => createIconStyles(theme), [theme]);

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
        <Input
          label="Task description (optional)"
          value={formData.description}
          onChangeText={text => updateField('description', text)}
          multiline
          numberOfLines={3}
          inputStyle={styles.textArea}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Input
          label="Medicine name"
          value={formData.medicineName}
          onChangeText={text => updateField('medicineName', text)}
          error={errors.medicineName}
        />
      </View>

      <View style={styles.fieldGroup}>
        <TouchableInput
          label={formData.medicineType ? 'Medication type' : undefined}
          value={formData.medicineType || undefined}
          placeholder="Medication type"
          onPress={onOpenMedicationTypeSheet}
          rightComponent={
            <Image source={Images.dropdownIcon} style={iconStyles.dropdownIcon} />
          }
          error={errors.medicineType}
        />
      </View>

      <View style={styles.fieldGroup}>
        <TouchableInput
          label="Dosage"
          value={formatDosageText(formData.dosages)}
          placeholder="Dosage"
          onPress={onOpenDosageSheet}
          rightComponent={
            <Image source={Images.dropdownIcon} style={iconStyles.dropdownIcon} />
          }
          error={errors.dosages}
        />
      </View>

      {/* Display Dosage Details */}
      {showDosageDisplay && formData.dosages.length > 0 && (
        <View style={styles.dosageDisplayContainer}>
          {formData.dosages.map((dosage) => (
            <TouchableOpacity
              key={dosage.id}
              style={styles.dosageDisplayRow}
              activeOpacity={0.6}
              onPress={onOpenDosageSheet}>
              <View style={styles.dosageDisplayField}>
                <Input
                  label="Dosage"
                  value={dosage.label}
                  editable={false}
                  pointerEvents="none"
                />
              </View>
              <View style={styles.dosageDisplayField}>
                <Input
                  label="Time"
                  value={formatDosageTime(dosage.time)}
                  editable={false}
                  pointerEvents="none"
                  icon={<Image source={Images.clockIcon} style={styles.calendarIcon} />}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.fieldGroup}>
        <TouchableInput
          label={formData.medicationFrequency ? 'Medication frequency' : undefined}
          value={formData.medicationFrequency || undefined}
          placeholder="Medication frequency"
          onPress={onOpenMedicationFrequencySheet}
          rightComponent={
            <Image source={Images.dropdownIcon} style={iconStyles.dropdownIcon} />
          }
          error={errors.medicationFrequency}
        />
      </View>

      {/* Start Date */}
      <View style={styles.fieldGroup}>
        <Text style={styles.sectionLabel}>Start Date</Text>
        <CalendarMonthStrip
          selectedDate={formData.startDate || new Date()}
          onChange={(date: Date) => updateField('startDate', date)}
        />
      </View>

      {/* End Date (only shown for recurring medications) */}
      {formData.medicationFrequency !== 'once' && (
        <View style={styles.fieldGroup}>
          <Text style={styles.sectionLabel}>End Date</Text>
          <CalendarMonthStrip
            selectedDate={formData.endDate || new Date()}
            onChange={(date: Date) => updateField('endDate', date)}
          />
        </View>
      )}
    </>
  );
};

const createMedicationStyles = (theme: any) =>
  StyleSheet.create({
    dosageDisplayContainer: {
      gap: theme.spacing['3'],
      marginBottom: theme.spacing['4'],
    },
    dosageDisplayRow: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
      paddingVertical: theme.spacing['2'],
      paddingHorizontal: theme.spacing['2'],
      borderRadius: theme.borderRadius.sm,
      backgroundColor: 'transparent',
    },
    dosageDisplayField: {
      flex: 1,
    },
    sectionLabel: {
      ...theme.typography.titleSmall,
      color: theme.colors.secondary,
      marginBottom: theme.spacing['2'],
    },
  });
