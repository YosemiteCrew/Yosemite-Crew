import type {TaskFormData, TaskFormErrors} from '@/features/tasks/types';
import {validateTaskForm as validateTaskFormUtility} from '@/utils/taskValidation';

export const validateTaskForm = (formData: TaskFormData): TaskFormErrors => {
  // In edit mode, don't require task type selection or check for backdates
  // since we're editing an existing task
  return validateTaskFormUtility(formData, null, {
    requireTaskTypeSelection: false,
    checkBackdates: false,
  });
};
