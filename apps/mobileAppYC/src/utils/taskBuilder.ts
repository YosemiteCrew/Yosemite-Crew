import type {
  TaskFormData,
  Task,
} from '@/features/tasks/types';

export const formatDateToISODate = (date: Date | null): string | null => {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatTimeToISO = (date: Date | null): string | undefined => {
  if (!date) return undefined;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const buildMedicationDetails = (formData: TaskFormData) => {
  const formattedDosages = formData.dosages.map(dosage => ({
    id: dosage.id,
    label: dosage.label,
    time: formatTimeToISO(new Date(dosage.time)) || '00:00:00',
  }));

  return {
    taskType: 'give-medication',
    medicineName: formData.medicineName,
    medicineType: formData.medicineType!,
    dosages: formattedDosages,
    frequency: formData.medicationFrequency!,
    startDate:
      formatDateToISODate(formData.startDate) ||
      new Date().toISOString().split('T')[0],
    endDate: formatDateToISODate(formData.endDate) || undefined,
  };
};

const buildObservationalToolDetails = (formData: TaskFormData) => {
  return {
    taskType: 'take-observational-tool',
    toolType: formData.observationalTool!,
    chronicConditionType: formData.chronicConditionType,
  };
};

const buildHygieneDetails = (formData: TaskFormData) => {
  return {
    taskType: formData.hygieneTaskType!,
    description: formData.description,
  };
};

const buildDietaryDetails = (formData: TaskFormData) => {
  return {
    taskType: formData.dietaryTaskType!,
    description: formData.description,
  };
};

const buildGenericDetails = (formData: TaskFormData) => {
  return {
    description: formData.description,
  };
};

export const buildTaskFromForm = (
  formData: TaskFormData,
  companionId: string,
): Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'completedAt'> => {
  const isMedication = formData.healthTaskType === 'give-medication';
  const isObservationalTool =
    formData.healthTaskType === 'take-observational-tool';

  let details: any = {};

  if (isMedication) {
    details = buildMedicationDetails(formData);
  } else if (isObservationalTool) {
    details = buildObservationalToolDetails(formData);
  } else if (formData.category === 'hygiene') {
    details = buildHygieneDetails(formData);
  } else if (formData.category === 'dietary') {
    details = buildDietaryDetails(formData);
  } else {
    details = buildGenericDetails(formData);
  }

  const taskDate = formData.date || formData.startDate || new Date();
  const formattedDate =
    formatDateToISODate(taskDate) || taskDate.toISOString().split('T')[0];
  const formattedTime = formData.time ? formatTimeToISO(formData.time) : undefined;

  return {
    companionId,
    category: formData.category!,
    subcategory: formData.subcategory || undefined,
    title: formData.title,
    date: formattedDate,
    time: formattedTime,
    frequency: formData.frequency || formData.medicationFrequency || 'once',
    assignedTo: formData.assignedTo || undefined,
    reminderEnabled: formData.reminderEnabled,
    reminderOptions: formData.reminderOptions,
    syncWithCalendar: formData.syncWithCalendar,
    calendarProvider: formData.calendarProvider || undefined,
    attachDocuments: formData.attachDocuments,
    attachments: formData.attachments,
    additionalNote: formData.additionalNote || undefined,
    details,
  };
};
