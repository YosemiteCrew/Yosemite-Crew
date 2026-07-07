import React from 'react';
import {TaskDatePickers, type TaskDatePickerControls} from './TaskDatePickers';
import {TaskBottomSheets} from './TaskBottomSheets';
import type {TaskFormData} from '@/features/tasks/types';
import type {TaskSheetRefs, TaskTypeSheetProps} from './taskSheetTypes';

interface TaskFormSheetsProps extends TaskSheetRefs {
  // Date pickers
  pickerControls: TaskDatePickerControls;

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
  closeTaskSheet: () => void;

  // Navigation
  onDiscard: () => void;

  // Optional: for Add screen only
  taskTypeSheetProps?: TaskTypeSheetProps;
}

/**
 * Consolidated component that renders all date pickers and bottom sheets
 * Eliminates ~40 lines of duplication between AddTaskScreen and EditTaskScreen
 */
export const TaskFormSheets: React.FC<TaskFormSheetsProps> = props => {
  const {
    pickerControls,
    formData,
    updateField,
    companionType,
    fileToDelete,
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    confirmDeleteFile,
    closeSheet,
    closeTaskSheet,
    onDiscard,
    taskTypeSheetProps,
    ...refs
  } = props;

  return (
    <>
      {/* Date & Time Pickers */}
      <TaskDatePickers
        pickerControls={pickerControls}
        formData={formData}
        updateField={updateField}
      />

      {/* Bottom Sheets */}
      <TaskBottomSheets
        formData={formData}
        updateField={updateField}
        companionType={companionType}
        fileToDelete={fileToDelete}
        refs={refs}
        handlers={{
          handleTakePhoto,
          handleChooseFromGallery,
          handleUploadFromDrive,
          confirmDeleteFile,
          closeSheet,
          closeTaskSheet,
          onDiscard,
        }}
        {...(taskTypeSheetProps && {taskTypeSheetProps})}
      />
    </>
  );
};
