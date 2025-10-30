import {useCallback} from 'react';
import {Alert} from 'react-native';
import type {TaskFormData, TaskFormErrors, TaskTypeSelection} from '@/features/tasks/types';

interface UseTaskFormValidationProps {
  setErrors: (errors: TaskFormErrors) => void;
  validateTaskForm: (formData: TaskFormData, taskTypeSelection?: TaskTypeSelection | null) => TaskFormErrors;
}

export const useTaskFormValidation = ({setErrors, validateTaskForm}: UseTaskFormValidationProps) => {
  const validateForm = useCallback((formData: TaskFormData, taskTypeSelection?: TaskTypeSelection | null): boolean => {
    const newErrors = validateTaskForm(formData, taskTypeSelection);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [setErrors, validateTaskForm]);

  const showErrorAlert = useCallback((title: string, error: unknown) => {
    Alert.alert(
      title,
      error instanceof Error ? error.message : 'Please try again.',
    );
  }, []);

  return {
    validateForm,
    showErrorAlert,
  };
};
