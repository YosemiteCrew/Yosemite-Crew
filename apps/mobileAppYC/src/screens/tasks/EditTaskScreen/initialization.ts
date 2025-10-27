import type {
  TaskFormData,
  Task,
  MedicationTaskDetails,
  ObservationalToolTaskDetails,
} from '@/features/tasks/types';

const parseDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return new Date(year, month - 1, day);
};

const parseTime = (timeStr: string | null | undefined): Date | null => {
  if (!timeStr) return null;
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const now = new Date();
  now.setHours(hours, minutes, seconds || 0, 0);
  return now;
};

const normalizeDosageTime = (dosageTime: string): string => {
  // Ensure dosage times are in ISO format for consistent handling
  if (!dosageTime) return new Date().toISOString();

  if (dosageTime.includes('T')) {
    // Already in ISO format
    return dosageTime;
  } else if (dosageTime.includes(':')) {
    // Time-only format, convert to today's ISO datetime
    const [hours, minutes, seconds] = dosageTime.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return new Date().toISOString();
    const date = new Date();
    date.setHours(hours, minutes, seconds || 0, 0);
    return date.toISOString();
  }

  return new Date().toISOString();
};

const extractMedicationData = (
  task: Task,
  medicationDetails: MedicationTaskDetails | null,
) => {
  const normalizedDosages = (medicationDetails?.dosages || []).map(dosage => ({
    ...dosage,
    time: normalizeDosageTime(dosage.time),
  }));

  return {
    medicineName: medicationDetails?.medicineName || '',
    medicineType: medicationDetails?.medicineType || null,
    dosages: normalizedDosages,
    medicationFrequency: medicationDetails?.frequency || null,
    startDate: parseDate(medicationDetails?.startDate || null),
    endDate: parseDate(medicationDetails?.endDate || null),
  };
};

const extractObservationalToolData = (
  observationalDetails: ObservationalToolTaskDetails | null,
) => {
  return {
    observationalTool: observationalDetails?.toolType || null,
    chronicConditionType: observationalDetails?.chronicConditionType || null,
  };
};

const extractTaskTypeData = (task: Task) => {
  const isMedication =
    task.details && 'taskType' in task.details && task.details.taskType === 'give-medication';
  const isObservationalTool =
    task.details &&
    'taskType' in task.details &&
    task.details.taskType === 'take-observational-tool';

  return {
    isMedication,
    isObservationalTool,
    healthTaskType: isMedication || isObservationalTool ? (task.details as any).taskType : null,
    hygieneTaskType: task.category === 'hygiene' ? (task.details as any)?.taskType : null,
    dietaryTaskType: task.category === 'dietary' ? (task.details as any)?.taskType : null,
  };
};

export const initializeFormDataFromTask = (task: Task): TaskFormData => {
  const {isMedication, isObservationalTool, healthTaskType, hygieneTaskType, dietaryTaskType} =
    extractTaskTypeData(task);

  const medicationDetails =
    isMedication && task.details ? (task.details as MedicationTaskDetails) : null;
  const observationalDetails =
    isObservationalTool && task.details ? (task.details as ObservationalToolTaskDetails) : null;

  const medicationData = extractMedicationData(task, medicationDetails);
  const observationalData = extractObservationalToolData(observationalDetails);

  return {
    category: task.category,
    subcategory: task.subcategory as any,
    parasitePreventionType: null,
    chronicConditionType: observationalData.chronicConditionType,
    healthTaskType,
    hygieneTaskType,
    dietaryTaskType,
    title: task.title,
    date: parseDate(task.date) || new Date(),
    time: parseTime(task.time),
    frequency: task.frequency as any,
    assignedTo: task.assignedTo || null,
    reminderEnabled: task.reminderEnabled,
    reminderOptions: task.reminderOptions || null,
    syncWithCalendar: task.syncWithCalendar,
    calendarProvider: task.calendarProvider || null,
    attachDocuments: task.attachDocuments,
    attachments: task.attachments || [],
    additionalNote: task.additionalNote || '',
    ...medicationData,
    observationalTool: observationalData.observationalTool,
    description:
      (task.details && 'description' in task.details ? task.details.description : '') || '',
  };
};
