import type {TaskFormData, TaskFormErrors} from '@/features/tasks/types';

export const isBackdatedDate = (date: Date | null): boolean => {
  if (!date) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < now;
};

export const validateMedicationFields = (
  formData: TaskFormData,
  errors: TaskFormErrors,
  checkBackdates: boolean = true,
): void => {
  if (!formData.medicineName.trim()) {
    errors.medicineName = 'Medicine name is required';
  }
  if (!formData.medicineType) {
    errors.medicineType = 'Medication type is required';
  }
  if (formData.dosages.length === 0) {
    errors.dosages = 'At least one dosage is required';
  }
  if (!formData.medicationFrequency) {
    errors.medicationFrequency = 'Medication frequency is required';
  }
  if (!formData.startDate) {
    errors.startDate = 'Start date is required';
  } else if (checkBackdates && isBackdatedDate(formData.startDate)) {
    errors.startDate = 'Start date cannot be in the past';
  }
};

export const validateObservationalToolFields = (
  formData: TaskFormData,
  errors: TaskFormErrors,
  checkBackdates: boolean = true,
): void => {
  if (!formData.observationalTool) {
    errors.observationalTool = 'Please select an observational tool';
  }
  if (!formData.date) {
    errors.date = 'Date is required';
  } else if (checkBackdates && isBackdatedDate(formData.date)) {
    errors.date = 'Date cannot be in the past';
  }
  if (!formData.frequency) {
    errors.frequency = 'Task frequency is required';
  }
};

export const validateStandardTaskFields = (
  formData: TaskFormData,
  errors: TaskFormErrors,
  checkBackdates: boolean = true,
): void => {
  if (!formData.date) {
    errors.date = 'Date is required';
  } else if (checkBackdates && isBackdatedDate(formData.date)) {
    errors.date = 'Date cannot be in the past';
  }
  if (!formData.frequency) {
    errors.frequency = 'Task frequency is required';
  }
};

export const validateTaskForm = (
  formData: TaskFormData,
  taskTypeSelection: any,
  options: {requireTaskTypeSelection?: boolean; checkBackdates?: boolean} = {},
): TaskFormErrors => {
  const {requireTaskTypeSelection = true, checkBackdates = true} = options;
  const newErrors: TaskFormErrors = {};

  if (requireTaskTypeSelection && !taskTypeSelection) {
    newErrors.category = 'Please select a task type';
  }

  if (!formData.title.trim()) {
    newErrors.title = 'Task name is required';
  }

  if (requireTaskTypeSelection && !formData.assignedTo) {
    newErrors.assignedTo = 'Assigned to is required';
  }

  const isMedication = formData.healthTaskType === 'give-medication';
  const isObservationalTool = formData.healthTaskType === 'take-observational-tool';

  if (isMedication) {
    validateMedicationFields(formData, newErrors, checkBackdates);
  } else if (isObservationalTool) {
    validateObservationalToolFields(formData, newErrors, checkBackdates);
  } else {
    validateStandardTaskFields(formData, newErrors, checkBackdates);
  }

  return newErrors;
};
