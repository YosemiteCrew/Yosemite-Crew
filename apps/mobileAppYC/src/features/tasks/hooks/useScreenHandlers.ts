import {useTaskFormHandlers} from './useTaskFormHandlers';
import {useTaskFormValidation} from './useTaskFormValidation';

interface UseScreenHandlersParams {
  hasUnsavedChanges: boolean;
  navigation: any;
  formSetup: any;
  validateTaskForm: any;  // Flexible type to handle both validation signatures
  setErrors: (errors: any) => void;
}

/**
 * Consolidates common handler setup for both Add and Edit task screens
 * Eliminates 18 duplicate lines between useAddTaskScreen and useEditTaskScreen
 */
export const useScreenHandlers = ({
  hasUnsavedChanges,
  navigation,
  formSetup,
  validateTaskForm,
  setErrors,
}: UseScreenHandlersParams) => {
  const {validateForm, showErrorAlert} = useTaskFormValidation({setErrors, validateTaskForm});

  const {handleBack, sheetHandlers} = useTaskFormHandlers({
    hasUnsavedChanges,
    discardSheetRef: formSetup.discardSheetRef,
    navigation,
    medicationTypeSheetRef: formSetup.medicationTypeSheetRef,
    dosageSheetRef: formSetup.dosageSheetRef,
    medicationFrequencySheetRef: formSetup.medicationFrequencySheetRef,
    observationalToolSheetRef: formSetup.observationalToolSheetRef,
    taskFrequencySheetRef: formSetup.taskFrequencySheetRef,
    assignTaskSheetRef: formSetup.assignTaskSheetRef,
    calendarSyncSheetRef: formSetup.calendarSyncSheetRef,
    setShowDatePicker: formSetup.setShowDatePicker,
    setShowTimePicker: formSetup.setShowTimePicker,
    setShowStartDatePicker: formSetup.setShowStartDatePicker,
    setShowEndDatePicker: formSetup.setShowEndDatePicker,
  });

  return {
    validateForm,
    showErrorAlert,
    handleBack,
    sheetHandlers,
  };
};
