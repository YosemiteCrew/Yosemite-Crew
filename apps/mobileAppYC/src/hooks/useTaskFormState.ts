import {useState} from 'react';
import type {TaskFormData, TaskFormErrors} from '@/features/tasks/types';

const DEFAULT_FORM_DATA: TaskFormData = {
  category: null,
  subcategory: null,
  parasitePreventionType: null,
  chronicConditionType: null,
  healthTaskType: null,
  hygieneTaskType: null,
  dietaryTaskType: null,
  title: '',
  date: new Date(),
  time: null,
  frequency: null,
  assignedTo: null,
  reminderEnabled: false,
  reminderOptions: null,
  syncWithCalendar: false,
  calendarProvider: null,
  attachDocuments: false,
  attachments: [],
  additionalNote: '',
  medicineName: '',
  medicineType: null,
  dosages: [],
  medicationFrequency: null,
  startDate: new Date(),
  endDate: null,
  observationalTool: null,
  description: '',
};

interface UseTaskFormStateReturn {
  formData: TaskFormData;
  setFormData: (data: TaskFormData) => void;
  errors: TaskFormErrors;
  setErrors: (errors: TaskFormErrors) => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  showDatePicker: boolean;
  setShowDatePicker: (value: boolean) => void;
  showTimePicker: boolean;
  setShowTimePicker: (value: boolean) => void;
  showStartDatePicker: boolean;
  setShowStartDatePicker: (value: boolean) => void;
  showEndDatePicker: boolean;
  setShowEndDatePicker: (value: boolean) => void;
  updateField: <K extends keyof TaskFormData>(field: K, value: TaskFormData[K]) => void;
  clearError: (field: keyof TaskFormErrors) => void;
  resetForm: () => void;
}

export const useTaskFormState = (initialData?: Partial<TaskFormData>): UseTaskFormStateReturn => {
  const [formData, setFormData] = useState<TaskFormData>({
    ...DEFAULT_FORM_DATA,
    ...initialData,
  });
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const updateField = <K extends keyof TaskFormData>(
    field: K,
    value: TaskFormData[K],
  ) => {
    setFormData(prev => ({...prev, [field]: value}));
    setHasUnsavedChanges(true);
    clearError(field as keyof TaskFormErrors);
  };

  const clearError = (field: keyof TaskFormErrors) => {
    setErrors(prev => {
      const newErrors = {...prev};
      delete newErrors[field];
      return newErrors;
    });
  };

  const resetForm = () => {
    setFormData({...DEFAULT_FORM_DATA, ...initialData});
    setErrors({});
    setHasUnsavedChanges(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
  };

  return {
    formData,
    setFormData,
    errors,
    setErrors,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    showDatePicker,
    setShowDatePicker,
    showTimePicker,
    setShowTimePicker,
    showStartDatePicker,
    setShowStartDatePicker,
    showEndDatePicker,
    setShowEndDatePicker,
    updateField,
    clearError,
    resetForm,
  };
};
