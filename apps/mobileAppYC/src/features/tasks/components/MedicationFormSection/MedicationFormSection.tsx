import React from 'react';
import {View, StyleSheet, Image, Text} from 'react-native';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {Input, TouchableInput} from '@/shared/components/common';
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/dateTimeFormat';
import {Images} from '@/assets/images';
import {createIconStyles} from '@/shared/utils/iconStyles';
import {createTaskFormSectionStyles} from '@/features/tasks/components/shared/taskFormStyles';
import type {TaskFormData, TaskFormErrors} from '@/features/tasks/types';

interface MedicationFormSectionProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  updateField: <K extends keyof TaskFormData>(
    field: K,
    value: TaskFormData[K],
  ) => void;
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
  onOpenStartDatePicker,
  onOpenEndDatePicker,
  theme,
  showDosageDisplay = true,
}) => {
  const baseStyles = React.useMemo(
    () => createTaskFormSectionStyles(theme),
    [theme],
  );
  const customStyles = React.useMemo(
    () => createMedicationStyles(theme),
    [theme],
  );
  const styles = React.useMemo(
    () => ({...baseStyles, ...customStyles}),
    [baseStyles, customStyles],
  );
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

      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeField}>
          <TouchableInput
            label="Medication type"
            value={formData.medicineType || undefined}
            placeholder="Medication type"
            onPress={onOpenMedicationTypeSheet}
            rightComponent={
              <Image
                source={Images.dropdownIcon}
                style={iconStyles.dropdownIcon}
              />
            }
            error={errors.medicineType}
          />
        </View>

        <View style={styles.dateTimeField}>
          <TouchableInput
            label="Dosage"
            value={formatDosageText(formData.dosages)}
            placeholder="Dosage"
            onPress={onOpenDosageSheet}
            rightComponent={
              <Image
                source={Images.dropdownIcon}
                style={iconStyles.dropdownIcon}
              />
            }
            error={errors.dosages}
          />
        </View>
      </View>

      {/* Doses inset card */}
      {showDosageDisplay && formData.dosages.length > 0 && (
        <View style={styles.dosesGroup}>
          <Text style={styles.dosesLabel}>Doses</Text>
          <View style={styles.dosesCard}>
            {formData.dosages.map((dosage, index) => (
              <PressableOpacity
                key={dosage.id}
                style={[styles.doseRow, index > 0 && styles.doseRowDivided]}
                activeOpacity={0.6}
                onPress={onOpenDosageSheet}
                accessibilityRole="button"
                accessibilityLabel={`${dosage.label}, ${formatDosageTime(dosage.time)}`}>
                <Text style={styles.doseLabel}>{dosage.label}</Text>
                <Text style={styles.doseMeta}>
                  {formatDosageTime(dosage.time)}
                </Text>
              </PressableOpacity>
            ))}
          </View>
          <PressableOpacity
            style={styles.addDoseRow}
            activeOpacity={0.7}
            onPress={onOpenDosageSheet}
            accessibilityRole="button"
            accessibilityLabel="Add dose">
            <Image source={Images.addIcon} style={styles.addDoseIcon} />
            <Text style={styles.addDoseText}>Add dose</Text>
          </PressableOpacity>
        </View>
      )}

      <View style={styles.fieldGroup}>
        <TouchableInput
          label={
            formData.medicationFrequency ? 'Medication frequency' : undefined
          }
          value={formData.medicationFrequency || undefined}
          placeholder="Medication frequency"
          onPress={onOpenMedicationFrequencySheet}
          rightComponent={
            <Image
              source={Images.dropdownIcon}
              style={iconStyles.dropdownIcon}
            />
          }
          error={errors.medicationFrequency}
        />
      </View>

      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeField}>
          <TouchableInput
            label="Start Date"
            value={
              formData.startDate
                ? formatDateForDisplay(formData.startDate)
                : undefined
            }
            placeholder="Start Date"
            onPress={onOpenStartDatePicker}
            rightComponent={
              <Image source={Images.calendarIcon} style={styles.calendarIcon} />
            }
            error={errors.startDate}
          />
        </View>

        {formData.medicationFrequency !== 'once' && (
          <View style={styles.dateTimeField}>
            <TouchableInput
              label="End Date"
              value={
                formData.endDate
                  ? formatDateForDisplay(formData.endDate)
                  : undefined
              }
              placeholder="End Date"
              onPress={onOpenEndDatePicker}
              rightComponent={
                <Image
                  source={Images.calendarIcon}
                  style={styles.calendarIcon}
                />
              }
              error={errors.endDate}
            />
          </View>
        )}
      </View>
    </>
  );
};

const createMedicationStyles = (theme: any) =>
  StyleSheet.create({
    dosesGroup: {
      marginBottom: theme.spacing['4'],
      gap: theme.spacing['2'],
    },
    dosesLabel: {
      ...theme.typography.inputLabel,
      color: theme.colors.inkBody,
      marginLeft: theme.spacing['1'],
    },
    dosesCard: {
      backgroundColor: theme.colors.screen2,
      borderRadius: theme.borderRadius.field,
      borderWidth: 1,
      borderColor: theme.colors.hairline,
      paddingHorizontal: theme.spacing['3.5'],
      paddingVertical: theme.spacing['1'],
    },
    doseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing['3.5'],
    },
    doseRowDivided: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.hairline,
    },
    doseLabel: {
      ...theme.typography.labelSmall,
      color: theme.colors.inkBody,
      fontWeight: '600',
    },
    doseMeta: {
      ...theme.typography.bodySmall,
      color: theme.colors.inkMuted,
      fontVariant: ['tabular-nums'],
    },
    addDoseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing['2'],
      height: theme.spacing['11'],
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.colors.divider,
      borderRadius: theme.borderRadius.field,
    },
    addDoseIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
    },
    addDoseText: {
      ...theme.typography.labelSmallBold,
      color: theme.colors.blueText,
    },
  });
