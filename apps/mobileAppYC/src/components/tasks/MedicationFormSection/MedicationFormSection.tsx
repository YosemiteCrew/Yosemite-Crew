import React from 'react';
import {View, StyleSheet, Image} from 'react-native';
import {Input, TouchableInput} from '@/components/common';
import {formatDateForDisplay} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import {Images} from '@/assets/images';
import type {TaskFormData, TaskFormErrors} from '@/features/tasks/types';

interface MedicationFormSectionProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  onOpenMedicationTypeSheet: () => void;
  onOpenDosageSheet: () => void;
  onOpenMedicationFrequencySheet: () => void;
  onOpenStartDatePicker: () => void;
  onOpenEndDatePicker: () => void;
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

export const MedicationFormSection: React.FC<MedicationFormSectionProps> = ({
  formData,
  errors,
  updateField,
  onOpenMedicationTypeSheet,
  onOpenDosageSheet,
  onOpenMedicationFrequencySheet,
  onOpenStartDatePicker,
  onOpenEndDatePicker,
  theme,
  showDosageDisplay = true,
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
            <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
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
            <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
          }
          error={errors.dosages}
        />
      </View>

      {/* Display Dosage Details */}
      {showDosageDisplay && formData.dosages.length > 0 && (
        <View style={styles.dosageDisplayContainer}>
          {formData.dosages.map((dosage) => (
            <View key={dosage.id} style={styles.dosageDisplayRow}>
              <View style={styles.dosageDisplayField}>
                <Input
                  label="Dosage"
                  value={dosage.label}
                  editable={false}
                />
              </View>
              <View style={styles.dosageDisplayField}>
                <Input
                  label="Time"
                  value={new Date(dosage.time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                  editable={false}
                  icon={<Image source={Images.clockIcon} style={styles.calendarIcon} />}
                />
              </View>
            </View>
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
            <Image source={Images.dropdownIcon} style={styles.dropdownIcon} />
          }
          error={errors.medicationFrequency}
        />
      </View>

      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeField}>
          <TouchableInput
            label={formData.startDate ? 'Start Date' : undefined}
            value={formData.startDate ? formatDateForDisplay(formData.startDate) : undefined}
            placeholder="Start Date"
            onPress={onOpenStartDatePicker}
            rightComponent={
              <Image source={Images.calendarIcon} style={styles.calendarIcon} />
            }
            error={errors.startDate}
          />
        </View>

        <View style={styles.dateTimeField}>
          <TouchableInput
            label={formData.endDate ? 'End Date' : undefined}
            value={formData.endDate ? formatDateForDisplay(formData.endDate) : undefined}
            placeholder="End Date"
            onPress={onOpenEndDatePicker}
            rightComponent={
              <Image source={Images.calendarIcon} style={styles.calendarIcon} />
            }
            error={errors.endDate}
          />
        </View>
      </View>
    </>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    fieldGroup: {
      marginBottom: theme.spacing[4],
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: theme.spacing[3],
      marginBottom: theme.spacing[4],
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
    dosageDisplayContainer: {
      gap: theme.spacing[3],
      marginBottom: theme.spacing[4],
    },
    dosageDisplayRow: {
      flexDirection: 'row',
      gap: theme.spacing[3],
    },
    dosageDisplayField: {
      flex: 1,
    },
  });
