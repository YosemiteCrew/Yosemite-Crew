import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import type {RootState, AppDispatch} from '@/app/store';
import {selectTaskById} from '@/features/tasks/selectors';
import {initializeFormDataFromTask} from '@/features/tasks/screens/EditTaskScreen/initialization';
import {validateTaskForm} from '@/features/tasks/screens/EditTaskScreen/validation';
import {useTaskFormSetup} from './useTaskFormSetup';
import {useTaskFormHelpers} from './useTaskFormHelpers';
import {useScreenHandlers} from './useScreenHandlers';
import {fetchCoParents} from '@/features/coParent/thunks';

/**
 * Consolidated hook for EditTaskScreen
 * Eliminates 35+ lines of duplicate setup code
 */
export const useEditTaskScreen = (taskId: string, navigation: any) => {
  const dispatch = useDispatch<AppDispatch>();
  const task = useSelector((state: RootState) => selectTaskById(taskId)(state));
  const loading = useSelector((state: RootState) => state.tasks.loading);
  const companions = useSelector((state: RootState) => state.companion.companions);

  const formSetup = useTaskFormSetup();
  const {formData, hasUnsavedChanges, setFormData, setErrors} = formSetup;

  const {isMedicationForm, isObservationalToolForm, isSimpleForm} = useTaskFormHelpers(formData);

  // Initialize form with task data
  useEffect(() => {
    if (task) {
      const initialFormData = initializeFormDataFromTask(task);
      setFormData(initialFormData);
      setErrors({});
    }
  }, [task, setFormData, setErrors]);

  useEffect(() => {
    if (task?.companionId) {
      const companion = companions?.find(c => c.id === task.companionId);
      dispatch(fetchCoParents({
        companionId: task.companionId,
        companionName: companion?.name,
        companionImage: companion?.profileImage ?? undefined,
      }));
    }
  }, [companions, dispatch, task?.companionId]);

  const {validateForm, showErrorAlert, handleBack, sheetHandlers} = useScreenHandlers({
    hasUnsavedChanges,
    navigation,
    formSetup,
    validateTaskForm,
    setErrors,
  });

  const handleDelete = () => {
    formSetup.deleteSheetRef.current?.open();
  };

  const companion = companions?.find(c => c.id === task?.companionId);
  const companionType = companion?.category || 'dog';

  return {
    // Data
    task,
    loading,
    companions,
    companionType,

    // Form helpers
    isMedicationForm,
    isObservationalToolForm,
    isSimpleForm,

    // Handlers
    handleBack,
    handleDelete,
    sheetHandlers,
    validateForm,
    showErrorAlert,

    // All formSetup state, refs and handlers (includes formData, errors, updateField, etc.)
    ...formSetup,
  };
};
