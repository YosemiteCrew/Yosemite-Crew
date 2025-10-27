import type {TaskTypeSelection, TaskFormData, TaskFormErrors} from '@/features/tasks/types';

// Helper to update task form data when task type selection changes
export const getUpdatedFormDataFromTaskType = (
  selection: TaskTypeSelection,
  _currentData: TaskFormData,
): Partial<TaskFormData> => {
  const updates: Partial<TaskFormData> = {
    category: selection.category,
    subcategory: selection.subcategory || null,
    parasitePreventionType: selection.parasitePreventionType || null,
    chronicConditionType: selection.chronicConditionType || null,
    title: selection.label,
  };

  // Handle health category
  if (selection.category === 'health') {
    // Health category - set health task type
    updates.healthTaskType = selection.taskType as any || null;

    // If medication, keep medication fields; otherwise clear them
    if (selection.taskType === 'give-medication') {
      // Medication fields will be preserved
    } else {
      updates.medicineName = '';
      updates.medicineType = null;
      updates.dosages = [];
      updates.medicationFrequency = null;
      updates.startDate = new Date();
      updates.endDate = null;
    }

    // If observational tool, keep field; otherwise clear it
    if (selection.taskType === 'take-observational-tool') {
      // Observational tool field will be preserved
    } else {
      updates.observationalTool = null;
    }
  } else {
    // Clear all health-specific fields
    updates.healthTaskType = null;
    updates.medicineName = '';
    updates.medicineType = null;
    updates.dosages = [];
    updates.medicationFrequency = null;
    updates.startDate = new Date();
    updates.endDate = null;
    updates.observationalTool = null;
  }

  // Handle hygiene category
  if (selection.category === 'hygiene') {
    updates.hygieneTaskType = selection.taskType as any || null;
  } else {
    updates.hygieneTaskType = null;
  }

  // Handle dietary category
  if (selection.category === 'dietary') {
    updates.dietaryTaskType = selection.taskType as any || null;
  } else {
    updates.dietaryTaskType = null;
  }

  return updates;
};

// Helper to determine which fields to clear errors for based on task type
export const getErrorFieldsToClear = (selection: TaskTypeSelection): (keyof TaskFormErrors)[] => {
  const fieldsToClear: (keyof TaskFormErrors)[] = [
    'category',
    'title',
  ];

  if (selection.category === 'health') {
    fieldsToClear.push('healthTaskType');

    if (selection.taskType === 'give-medication') {
      fieldsToClear.push('medicineName', 'medicineType', 'dosages', 'medicationFrequency', 'startDate');
    }

    if (selection.taskType === 'take-observational-tool') {
      fieldsToClear.push('observationalTool');
    }
  }

  return fieldsToClear;
};

// Helper to check if form is a medication form
export const isMedicationForm = (healthTaskType: string | null): boolean => {
  return healthTaskType === 'give-medication';
};

// Helper to check if form is an observational tool form
export const isObservationalToolForm = (healthTaskType: string | null): boolean => {
  return healthTaskType === 'take-observational-tool';
};

// Helper to check if form is a simple form
export const isSimpleForm = (healthTaskType: string | null): boolean => {
  return !isMedicationForm(healthTaskType) && !isObservationalToolForm(healthTaskType);
};
