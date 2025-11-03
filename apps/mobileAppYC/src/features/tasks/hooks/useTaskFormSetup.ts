import {useFormBottomSheets, useFileOperations, useTaskFormState, useTaskFormSheets} from '@/hooks';

/**
 * Consolidates all form state, sheet refs, and file operations setup
 * Used by both AddTaskScreen and EditTaskScreen to eliminate duplication
 */
export const useTaskFormSetup = () => {
  const taskFormState = useTaskFormState();
  const {updateField, clearError, formData} = taskFormState;

  const {refs, openSheet, closeSheet} = useFormBottomSheets();
  const {uploadSheetRef, deleteSheetRef: formDeleteSheetRef} = refs;

  const taskFormSheets = useTaskFormSheets();
  const {openTaskSheet, closeTaskSheet, ...taskSheetRefs} = taskFormSheets;

  const fileOperations = useFileOperations({
    files: formData.attachments as any,
    setFiles: files => updateField('attachments', files),
    clearError: () => clearError('attachments'),
    openSheet,
    closeSheet,
    deleteSheetRef: formDeleteSheetRef,
  });

  return {
    ...taskFormState,
    uploadSheetRef,
    deleteSheetRef: formDeleteSheetRef,
    ...taskSheetRefs,
    ...fileOperations,
    openSheet,
    closeSheet,
    openTaskSheet,
    closeTaskSheet,
  };
};
