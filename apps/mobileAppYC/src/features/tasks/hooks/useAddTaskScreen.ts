import {useState, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {setSelectedCompanion} from '@/features/companion';
import type {AppDispatch, RootState} from '@/app/store';
import type {TaskTypeSelection} from '@/features/tasks/types';
import {getUpdatedFormDataFromTaskType, getErrorFieldsToClear} from '@/features/tasks/utils/taskFormHelpers';
import {useTaskFormSetup} from './useTaskFormSetup';
import {useTaskFormHelpers} from './useTaskFormHelpers';
import {useScreenHandlers} from './useScreenHandlers';
import {validateTaskForm} from '@/features/tasks/screens/AddTaskScreen/validation';

/**
 * Consolidated hook for AddTaskScreen
 * Eliminates 35+ lines of duplicate setup code
 */
export const useAddTaskScreen = (navigation: any) => {
  const dispatch = useDispatch<AppDispatch>();

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector((state: RootState) => state.companion.selectedCompanionId);
  const loading = useSelector((state: RootState) => state.tasks.loading);

  const formSetup = useTaskFormSetup();
  const {formData, hasUnsavedChanges, setErrors, setHasUnsavedChanges, updateField, clearError} = formSetup;

  const [taskTypeSelection, setTaskTypeSelection] = useState<TaskTypeSelection | null>(null);

  const {isMedicationForm, isObservationalToolForm, isSimpleForm} = useTaskFormHelpers(formData);

  useEffect(() => {
    if (!selectedCompanionId && companions.length > 0) {
      dispatch(setSelectedCompanion(companions[0].id));
    }
  }, [companions, selectedCompanionId, dispatch]);

  const handleTaskTypeSelect = (selection: TaskTypeSelection) => {
    const updatedFormData = getUpdatedFormDataFromTaskType(selection, formData);
    for (const [key, value] of Object.entries(updatedFormData)) {
      updateField(key as keyof typeof formData, value);
    }
    setTaskTypeSelection(selection);
    setHasUnsavedChanges(true);

    const fieldsToClear = getErrorFieldsToClear(selection);
    for (const field of fieldsToClear) {
      clearError(field);
    }
  };

  const handleCompanionSelect = (companionId: string | null) => {
    if (companionId) {
      dispatch(setSelectedCompanion(companionId));
    }
  };

  const {validateForm, showErrorAlert, handleBack, sheetHandlers} = useScreenHandlers({
    hasUnsavedChanges,
    navigation,
    formSetup,
    validateTaskForm,
    setErrors,
  });

  const selectedCompanion = companions.find(c => c.id === selectedCompanionId);
  const companionType = selectedCompanion?.category || 'dog';

  return {
    // Selectors
    companions,
    selectedCompanionId,
    loading,
    companionType,

    // Task type selection
    taskTypeSelection,

    // Form helpers
    isMedicationForm,
    isObservationalToolForm,
    isSimpleForm,

    // Handlers
    handleTaskTypeSelect,
    handleCompanionSelect,
    handleBack,
    sheetHandlers,
    validateForm,
    showErrorAlert,

    // All formSetup state, refs and handlers (includes formData, errors, updateField, etc.)
    ...formSetup,
  };
};
