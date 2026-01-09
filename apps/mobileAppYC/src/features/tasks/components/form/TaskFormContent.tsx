import React from 'react';
import {View, Text, Switch, Image} from 'react-native';
import {TouchableInput} from '@/shared/components/common';
import {DocumentAttachmentsSection} from '@/features/documents/components/DocumentAttachmentsSection';
import {
  MedicationFormSection,
  ObservationalToolFormSection,
  SimpleTaskFormSection,
  ReminderSection,
  CalendarSyncSection,
  CommonTaskFields,
} from '@/features/tasks/screens/AddTaskScreen/components';
import {Images} from '@/assets/images';
import {createIconStyles} from '@/shared/utils/iconStyles';
import type {TaskTypeSelection, ReminderOption, TaskFormData, TaskFormErrors} from '@/features/tasks/types';

interface TaskFormContentProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  theme: any;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  isMedicationForm: boolean;
  isObservationalToolForm: boolean;
  isSimpleForm: boolean;
  reminderOptions: ReminderOption[];
  styles: any;
  taskTypeSelection?: TaskTypeSelection | null;
  showTaskTypeSelector?: boolean;
  taskTypeSelectorProps?: {
    onPress: () => void;
    value?: string;
    error?: string;
  };
  sheetHandlers: {
    onOpenMedicationTypeSheet: () => void;
    onOpenDosageSheet: () => void;
    onOpenMedicationFrequencySheet: () => void;
    onOpenStartDatePicker: () => void;
    onOpenEndDatePicker: () => void;
    onOpenObservationalToolSheet: () => void;
    onOpenDatePicker: () => void;
    onOpenTimePicker: () => void;
    onOpenTaskFrequencySheet: () => void;
    onOpenAssignTaskSheet: () => void;
    onOpenCalendarSyncSheet: () => void;
  };
  fileHandlers: {
    onAddPress: () => void;
    onRequestRemove: (fileId: string) => void;
  };
  fileError?: string;
}

export const TaskFormContent: React.FC<TaskFormContentProps> = ({
  formData,
  errors,
  theme,
  updateField,
  isMedicationForm,
  isObservationalToolForm,
  isSimpleForm,
  reminderOptions,
  styles,
  taskTypeSelection,
  showTaskTypeSelector,
  taskTypeSelectorProps,
  sheetHandlers,
  fileHandlers,
  fileError,
}) => {
  const iconStyles = React.useMemo(() => createIconStyles(theme), [theme]);

  return (
    <>
      {showTaskTypeSelector && taskTypeSelectorProps && (
        <View style={styles.fieldGroup}>
          <TouchableInput
            label={taskTypeSelection ? 'Task type' : undefined}
            placeholder="Task Type"
            value={taskTypeSelectorProps.value}
            onPress={taskTypeSelectorProps.onPress}
            rightComponent={<Image source={Images.dropdownIcon} style={iconStyles.dropdownIcon} />}
            error={taskTypeSelectorProps.error}
          />
        </View>
      )}

      {(taskTypeSelection || !showTaskTypeSelector) && (
        <>
          {isMedicationForm && (
            <MedicationFormSection
              formData={formData}
              errors={errors}
              updateField={updateField}
              onOpenMedicationTypeSheet={sheetHandlers.onOpenMedicationTypeSheet}
              onOpenDosageSheet={sheetHandlers.onOpenDosageSheet}
              onOpenMedicationFrequencySheet={sheetHandlers.onOpenMedicationFrequencySheet}
              onOpenStartDatePicker={sheetHandlers.onOpenStartDatePicker}
              onOpenEndDatePicker={sheetHandlers.onOpenEndDatePicker}
              theme={theme}
            />
          )}

          {isObservationalToolForm && (
            <ObservationalToolFormSection
              formData={formData}
              errors={errors}
              updateField={updateField}
              onOpenObservationalToolSheet={sheetHandlers.onOpenObservationalToolSheet}
              onOpenDatePicker={sheetHandlers.onOpenDatePicker}
              onOpenTimePicker={sheetHandlers.onOpenTimePicker}
              onOpenTaskFrequencySheet={sheetHandlers.onOpenTaskFrequencySheet}
              theme={theme}
            />
          )}

          {isSimpleForm && (
            <SimpleTaskFormSection
              formData={formData}
              errors={errors}
              taskTypeSelection={taskTypeSelection ?? undefined}
              updateField={updateField}
              onOpenDatePicker={sheetHandlers.onOpenDatePicker}
              onOpenTimePicker={sheetHandlers.onOpenTimePicker}
              onOpenTaskFrequencySheet={sheetHandlers.onOpenTaskFrequencySheet}
              theme={theme}
            />
          )}

          <CommonTaskFields
            formData={formData}
            errors={errors}
            updateField={updateField}
            onOpenAssignTaskSheet={sheetHandlers.onOpenAssignTaskSheet}
            theme={theme}
          />

          <ReminderSection
            formData={formData}
            updateField={updateField}
            reminderOptions={reminderOptions}
            theme={theme}
          />

          <CalendarSyncSection
            formData={formData}
            updateField={updateField}
            onOpenCalendarSyncSheet={sheetHandlers.onOpenCalendarSyncSheet}
            theme={theme}
          />

          <View style={styles.toggleSection}>
            <Text style={styles.toggleLabel}>Attach document</Text>
            <Switch
              value={formData.attachDocuments}
              onValueChange={value => updateField('attachDocuments', value)}
              trackColor={{false: theme.colors.borderMuted, true: theme.colors.primary}}
              thumbColor={theme.colors.white}
            />
          </View>

          {formData.attachDocuments && (
            <View style={styles.fieldGroup}>
              <DocumentAttachmentsSection
                files={formData.attachments as any}
                onAddPress={fileHandlers.onAddPress}
                onRequestRemove={file => fileHandlers.onRequestRemove(file.id)}
                error={fileError}
                emptyTitle="Upload documents"
                emptySubtitle="Only DOC, PDF, PNG, JPEG formats with max size 5 MB"
              />
            </View>
          )}
        </>
      )}
    </>
  );
};
