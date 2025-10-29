import type {
  TaskCategory,
  HealthSubcategory,
  HealthTaskType,
  HygieneTaskType,
  DietaryTaskType,
  MedicationType,
  MedicationFrequency,
  TaskFrequency,
  ObservationalTool,
  ReminderOption,
  ParasitePreventionType,
  ChronicConditionType,
} from '@/features/tasks/types';

// Category Labels
export const resolveCategoryLabel = (category: TaskCategory): string => {
  const labels: Record<TaskCategory, string> = {
    health: 'Health',
    hygiene: 'Hygiene',
    dietary: 'Dietary',
    custom: 'Custom',
  };
  return labels[category] || category;
};

// Health Subcategory Labels
export const resolveHealthSubcategoryLabel = (
  subcategory: HealthSubcategory,
): string => {
  const labels: Record<HealthSubcategory, string> = {
    vaccination: 'Vaccination',
    'parasite-prevention': 'Parasite Prevention',
    'chronic-conditions': 'Chronic Conditions',
  };
  return labels[subcategory] || subcategory;
};

// Parasite Prevention Type Labels
export const resolveParasitePreventionLabel = (
  type: ParasitePreventionType,
): string => {
  const labels: Record<ParasitePreventionType, string> = {
    deworming: 'Deworming',
    'flea-tick-prevention': 'Flea and tick risk prevention',
  };
  return labels[type] || type;
};

// Chronic Condition Type Labels
export const resolveChronicConditionLabel = (
  type: ChronicConditionType,
): string => {
  const labels: Record<ChronicConditionType, string> = {
    pain: 'Pain',
    diabetes: 'Diabetes',
    epilepsy: 'Epilepsy',
  };
  return labels[type] || type;
};

// Health Task Type Labels
export const resolveHealthTaskTypeLabel = (taskType: HealthTaskType): string => {
  const labels: Record<HealthTaskType, string> = {
    'give-medication': 'Give medication',
    'take-observational-tool': 'Take observational tool',
    vaccination: 'Vaccination',
  };
  return labels[taskType] || taskType;
};

// Hygiene Task Type Labels
export const resolveHygieneTaskTypeLabel = (
  taskType: HygieneTaskType,
): string => {
  const labels: Record<HygieneTaskType, string> = {
    'brushing-hair': 'Brushing hair',
    'dental-care': 'Take dental care',
    'nail-trimming': 'Nail trimming',
    'give-bath': 'Give bath',
    'take-exercise': 'Take for excercise',
    'give-training': 'Give training',
  };
  return labels[taskType] || taskType;
};

// Dietary Task Type Labels
export const resolveDietaryTaskTypeLabel = (
  taskType: DietaryTaskType,
): string => {
  const labels: Record<DietaryTaskType, string> = {
    meals: 'Meals',
    freshwater: 'Freshwater',
  };
  return labels[taskType] || taskType;
};

// Medication Type Labels
export const resolveMedicationTypeLabel = (type: MedicationType): string => {
  const labels: Record<MedicationType, string> = {
    'tablets-pills': 'Tablets/Pills',
    capsule: 'Capsule',
    liquids: 'Liquids',
    'topical-medicine': 'Topical medicine',
    injection: 'Injection',
    inhales: 'Inhales',
    patches: 'Patches',
    suppositories: 'Suppositories',
    'sprinkle-capsules': 'Sprinkle Capsules',
  };
  return labels[type] || type;
};

// Medication Frequency Labels
export const resolveMedicationFrequencyLabel = (
  frequency: MedicationFrequency,
): string => {
  const labels: Record<MedicationFrequency, string> = {
    once: 'Once',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };
  return labels[frequency] || frequency;
};

// Task Frequency Labels
export const resolveTaskFrequencyLabel = (frequency: TaskFrequency): string => {
  const labels: Record<TaskFrequency, string> = {
    once: 'Once',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    'every-day': 'Every day',
  };
  return labels[frequency] || frequency;
};

// Observational Tool Labels
export const resolveObservationalToolLabel = (
  tool: ObservationalTool,
): string => {
  const labels: Record<ObservationalTool, string> = {
    'feline-grimace-scale': 'Feline grimace scale',
    'canine-acute-pain-scale': 'Canine acute pain scale',
    'equine-grimace-scale': 'Equine Grimace Scale',
  };
  return labels[tool] || tool;
};

// Reminder Option Labels
export const resolveReminderOptionLabel = (option: ReminderOption): string => {
  const labels: Record<ReminderOption, string> = {
    '5-mins-prior': '5 mins prior',
    '30-mins-prior': '30 mins prior',
    '1-hour-prior': '1 hour prior',
    '12-hours-prior': '12 hours prior',
    '1-day-prior': '1 day prior',
    '3-days-prior': '3 days prior',
    custom: 'Custom',
  };
  return labels[option] || option;
};

// Get task title based on category and task type
export const getTaskTitle = (
  category: TaskCategory,
  taskType?: string,
): string => {
  if (category === 'health') {
    if (taskType === 'give-medication') return 'Give medication';
    if (taskType === 'take-observational-tool') return 'Take observational tool';
    if (taskType === 'vaccination') return 'Vaccination';
  }
  if (category === 'hygiene') {
    if (taskType) return resolveHygieneTaskTypeLabel(taskType as HygieneTaskType);
  }
  if (category === 'dietary') {
    if (taskType) return resolveDietaryTaskTypeLabel(taskType as DietaryTaskType);
  }
  if (category === 'custom') return 'Custom task';

  return 'New task';
};

// Build full breadcrumb path for task type selection
export const buildTaskTypeBreadcrumb = (
  category: TaskCategory,
  subcategory?: HealthSubcategory | null,
  parasitePreventionType?: ParasitePreventionType | null,
  chronicConditionType?: ChronicConditionType | null,
  taskType?: string,
): string => {
  if (category === 'custom') {
    return 'Custom';
  }

  if (category === 'health') {
    let path = 'Health';

    if (subcategory) {
      path += ` - ${resolveHealthSubcategoryLabel(subcategory)}`;

      if (parasitePreventionType) {
        path += `, ${resolveParasitePreventionLabel(parasitePreventionType)}`;
      } else if (chronicConditionType) {
        path += `, ${resolveChronicConditionLabel(chronicConditionType)}`;
      }
    }

    return path;
  }

  if (category === 'hygiene') {
    return `Hygiene - ${taskType ? resolveHygieneTaskTypeLabel(taskType as HygieneTaskType) : ''}`;
  }

  if (category === 'dietary') {
    return `Dietary - ${taskType ? resolveDietaryTaskTypeLabel(taskType as DietaryTaskType) : ''}`;
  }

  return 'Task Type';
};
