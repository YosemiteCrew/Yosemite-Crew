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
import type {
  TaskTypeSelection,
  ReminderOption,
  TaskFormData,
  TaskFormErrors,
} from '@/features/tasks/types';

export type TaskFormMode = 'medication' | 'observationalTool' | 'simple';

interface TaskTypeSelectorConfig {
  onPress: () => void;
  value?: string;
  error?: string;
}

interface TaskFormContentProps {
  formData: TaskFormData;
  errors: TaskFormErrors;
  theme: any;
  updateField: <K extends keyof TaskFormData>(
    field: K,
    value: TaskFormData[K],
  ) => void;
  taskFormMode: TaskFormMode;
  reminderOptions: ReminderOption[];
  styles: any;
  taskTypeSelection?: TaskTypeSelection | null;
  taskTypeSelector?: TaskTypeSelectorConfig;
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
  taskFormMode,
  reminderOptions,
  styles,
  taskTypeSelection,
  taskTypeSelector,
  sheetHandlers,
  fileHandlers,
  fileError,
}) => {
  const iconStyles = React.useMemo(() => createIconStyles(theme), [theme]);
  const formIsVisible = taskTypeSelection || !taskTypeSelector;

  return (
    <>
      {taskTypeSelector && (
        <View style={styles.fieldGroup}>
          <TouchableInput
            label={taskTypeSelection ? 'Task type' : undefined}
            placeholder="Task Type"
            value={taskTypeSelector.value}
            onPress={taskTypeSelector.onPress}
            rightComponent={
              <Image
                source={Images.dropdownIcon}
                style={iconStyles.dropdownIcon}
              />
            }
            error={taskTypeSelector.error}
          />
        </View>
      )}

      {formIsVisible && (
        <>
          {taskFormMode === 'medication' && (
            <MedicationFormSection
              formData={formData}
              errors={errors}
              updateField={updateField}
              onOpenMedicationTypeSheet={
                sheetHandlers.onOpenMedicationTypeSheet
              }
              onOpenDosageSheet={sheetHandlers.onOpenDosageSheet}
              onOpenMedicationFrequencySheet={
                sheetHandlers.onOpenMedicationFrequencySheet
              }
              onOpenStartDatePicker={sheetHandlers.onOpenStartDatePicker}
              onOpenEndDatePicker={sheetHandlers.onOpenEndDatePicker}
              theme={theme}
            />
          )}

          {taskFormMode === 'observationalTool' && (
            <ObservationalToolFormSection
              formData={formData}
              errors={errors}
              updateField={updateField}
              onOpenObservationalToolSheet={
                sheetHandlers.onOpenObservationalToolSheet
              }
              onOpenDatePicker={sheetHandlers.onOpenDatePicker}
              onOpenTimePicker={sheetHandlers.onOpenTimePicker}
              onOpenTaskFrequencySheet={sheetHandlers.onOpenTaskFrequencySheet}
              theme={theme}
            />
          )}

          {taskFormMode === 'simple' && (
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
              trackColor={{
                false: theme.colors.borderMuted,
                true: theme.colors.primary,
              }}
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
