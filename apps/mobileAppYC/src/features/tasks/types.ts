// Task Categories
export type TaskCategory = 'health' | 'hygiene' | 'dietary' | 'custom';

// Health Subcategories
export type HealthSubcategory =
  | 'vaccination'
  | 'parasite-prevention'
  | 'chronic-conditions';

// Health - Parasite Prevention Types
export type ParasitePreventionType = 'deworming' | 'flea-tick-prevention';

// Health - Chronic Conditions Types
export type ChronicConditionType = 'pain' | 'diabetes' | 'epilepsy';

// Health Task Types
export type HealthTaskType = 'give-medication' | 'take-observational-tool' | 'vaccination';

// Hygiene Task Types
export type HygieneTaskType =
  | 'brushing-hair'
  | 'dental-care'
  | 'nail-trimming'
  | 'give-bath'
  | 'take-exercise'
  | 'give-training';

// Dietary Task Types
export type DietaryTaskType = 'meals' | 'freshwater';

// Medication Types
export type MedicationType =
  | 'tablets-pills'
  | 'capsule'
  | 'liquids'
  | 'topical-medicine'
  | 'injection'
  | 'inhales'
  | 'patches'
  | 'suppositories'
  | 'sprinkle-capsules';

// Medication Frequency
export type MedicationFrequency = 'once' | 'daily' | 'weekly' | 'monthly';

// Task Frequency
export type TaskFrequency =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'every-day';

// Observational Tools
export type ObservationalTool =
  | 'feline-grimace-scale'
  | 'canine-acute-pain-scale'
  | 'equine-grimace-scale';

// Reminder Options
export type ReminderOption =
  | '5-mins-prior'
  | '30-mins-prior'
  | '1-hour-prior'
  | '12-hours-prior'
  | '1-day-prior'
  | '3-days-prior'
  | 'custom';

// Task Status
export type TaskStatus = 'pending' | 'completed' | 'overdue';

// Dosage Schedule
export interface DosageSchedule {
  id: string;
  label: string; // e.g., "Dose 1", "Dose 2"
  time: string; // ISO time string
}

// Health - Medication Task
export interface MedicationTaskDetails {
  taskType: 'give-medication';
  medicineName: string;
  medicineType: MedicationType;
  dosages: DosageSchedule[];
  frequency: MedicationFrequency;
  startDate: string; // ISO date
  endDate?: string; // ISO date
}

// Health - Observational Tool Task
export interface ObservationalToolTaskDetails {
  taskType: 'take-observational-tool';
  toolType: ObservationalTool;
  chronicConditionType?: ChronicConditionType;
}

// Health - Vaccination Task
export interface VaccinationTaskDetails {
  taskType: 'vaccination';
  vaccineName: string;
}

// Hygiene Task
export interface HygieneTaskDetails {
  taskType: HygieneTaskType;
  description?: string;
}

// Dietary Task
export interface DietaryTaskDetails {
  taskType: DietaryTaskType;
  description?: string;
}

// Custom Task
export interface CustomTaskDetails {
  description?: string;
}

export type TaskSpecificDetails =
  | MedicationTaskDetails
  | ObservationalToolTaskDetails
  | VaccinationTaskDetails
  | HygieneTaskDetails
  | DietaryTaskDetails
  | CustomTaskDetails;

// Base Task Interface
export interface Task {
  id: string;
  companionId: string;
  category: TaskCategory;
  subcategory?: HealthSubcategory | 'none';
  title: string;
  date: string; // ISO date
  time?: string; // ISO time string
  frequency: TaskFrequency;
  assignedTo?: string; // User ID
  reminderEnabled: boolean;
  reminderOptions: ReminderOption | null;
  syncWithCalendar: boolean;
  calendarProvider?: 'google' | 'icloud';
  attachDocuments: boolean;
  attachments: TaskAttachment[];
  additionalNote?: string;
  status: TaskStatus;
  completedAt?: string; // ISO datetime
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
  details: TaskSpecificDetails;
}

// Task Attachment
export interface TaskAttachment {
  id: string;
  name: string;
  uri: string;
  type: string;
  size: number;
}

// Tasks State
export interface TasksState {
  items: Task[];
  loading: boolean;
  error: string | null;
  hydratedCompanions: Record<string, boolean>;
}

// Form Data Types
export interface BaseTaskFormData {
  category: TaskCategory | null;
  subcategory: HealthSubcategory | null;
  parasitePreventionType: ParasitePreventionType | null;
  chronicConditionType: ChronicConditionType | null;
  healthTaskType: HealthTaskType | null;
  hygieneTaskType: HygieneTaskType | null;
  dietaryTaskType: DietaryTaskType | null;
  title: string;
  date: Date | null;
  time: Date | null;
  frequency: TaskFrequency | null;
  assignedTo: string | null;
  reminderEnabled: boolean;
  reminderOptions: ReminderOption | null;
  syncWithCalendar: boolean;
  calendarProvider: 'google' | 'icloud' | null;
  attachDocuments: boolean;
  attachments: TaskAttachment[];
  additionalNote: string;
}

export interface MedicationFormData extends BaseTaskFormData {
  medicineName: string;
  medicineType: MedicationType | null;
  dosages: DosageSchedule[];
  medicationFrequency: MedicationFrequency | null;
  startDate: Date | null;
  endDate: Date | null;
}

export interface ObservationalToolFormData extends BaseTaskFormData {
  observationalTool: ObservationalTool | null;
}

export interface TaskFormData
  extends MedicationFormData,
    ObservationalToolFormData {
  description: string;
}

export interface TaskFormErrors {
  category?: string;
  subcategory?: string;
  parasitePreventionType?: string;
  chronicConditionType?: string;
  healthTaskType?: string;
  hygieneTaskType?: string;
  dietaryTaskType?: string;
  observationalTool?: string;
  title?: string;
  date?: string;
  time?: string;
  frequency?: string;
  assignedTo?: string;
  medicineName?: string;
  medicineType?: string;
  dosages?: string;
  medicationFrequency?: string;
  startDate?: string;
  endDate?: string;
  attachments?: string;
  description?: string;
  additionalNote?: string;
}

// Task Type Selection for bottom sheet
export interface TaskTypeSelection {
  category: TaskCategory;
  subcategory?: HealthSubcategory;
  parasitePreventionType?: ParasitePreventionType;
  chronicConditionType?: ChronicConditionType;
  taskType?: HealthTaskType | HygieneTaskType | DietaryTaskType;
  label: string;
}
