import React from 'react';
import {TaskDatePickers} from './TaskDatePickers';
import {TaskBottomSheets} from './TaskBottomSheets';
import type {TaskFormData} from '@/features/tasks/types';
import type {TaskSheetRefs, TaskTypeSheetProps} from './taskSheetTypes';

interface TaskFormSheetsProps extends TaskSheetRefs {
  // Date pickers
  showDatePicker: boolean;
  setShowDatePicker: (show: boolean) => void;
  showTimePicker: boolean;
  setShowTimePicker: (show: boolean) => void;
  showStartDatePicker: boolean;
  setShowStartDatePicker: (show: boolean) => void;
  showEndDatePicker: boolean;
  setShowEndDatePicker: (show: boolean) => void;

  // Form data
  formData: TaskFormData;
  updateField: any;

  // Companion
  companionType: string;

  // File operations
  fileToDelete: any;
  handleTakePhoto: () => void;
  handleChooseFromGallery: () => void;
  handleUploadFromDrive: () => void;
  confirmDeleteFile: () => void;
  closeSheet: () => void;
  openSheet: (sheet: string) => void;

  // Navigation
  onDiscard: () => void;

  // Optional: for Add screen only
  taskTypeSheetProps?: TaskTypeSheetProps;
}

/**
 * Consolidated component that renders all date pickers and bottom sheets
 * Eliminates ~40 lines of duplication between AddTaskScreen and EditTaskScreen
 */
export const TaskFormSheets: React.FC<TaskFormSheetsProps> = (props) => {
  const {
    showDatePicker,
    setShowDatePicker,
    showTimePicker,
    setShowTimePicker,
    showStartDatePicker,
    setShowStartDatePicker,
    showEndDatePicker,
    setShowEndDatePicker,
    formData,
    updateField,
    companionType,
    fileToDelete,
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    confirmDeleteFile,
    closeSheet,
    onDiscard,
    taskTypeSheetProps,
    ...refs
  } = props;

  return (
    <>
      {/* Date & Time Pickers */}
      <TaskDatePickers
        showDatePicker={showDatePicker}
        setShowDatePicker={setShowDatePicker}
        showTimePicker={showTimePicker}
        setShowTimePicker={setShowTimePicker}
        showStartDatePicker={showStartDatePicker}
        setShowStartDatePicker={setShowStartDatePicker}
        showEndDatePicker={showEndDatePicker}
        setShowEndDatePicker={setShowEndDatePicker}
        formData={formData}
        updateField={updateField}
      />

      {/* Bottom Sheets */}
      <TaskBottomSheets
        formData={formData}
        updateField={updateField}
        companionType={companionType}
        fileToDelete={fileToDelete}
        refs={refs as TaskSheetRefs}
        handlers={{
          handleTakePhoto,
          handleChooseFromGallery,
          handleUploadFromDrive,
          confirmDeleteFile,
          closeSheet,
          onDiscard,
        }}
        {...(taskTypeSheetProps && {taskTypeSheetProps})}
      />
    </>
  );
};
