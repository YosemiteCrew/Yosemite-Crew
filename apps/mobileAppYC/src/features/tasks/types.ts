// Task Categories
export type TaskCategory = 'health' | 'hygiene' | 'dietary' | 'custom';
export type TaskBackendCategory =
  | 'MEDICATION'
  | 'OBSERVATION_TOOL'
  | 'HYGIENE'
  | 'DIET'
  | 'CUSTOM';

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
  | 'monthly';


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
export type TaskStatusApi = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus =
  | TaskStatusApi
  | 'pending'
  | 'completed'
  | 'overdue'
  | 'in_progress'
  | 'cancelled';

export type RecurrenceType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'CUSTOM';
export type OTFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'CHOICE'
  | 'BOOLEAN'
  | 'PHOTO'
  | 'VIDEO';

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
  toolType: string;
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
  /**
   * Normalized task kind from backend; falls back to category mapping used in UI.
   */
  backendCategory?: TaskBackendCategory;
  category: TaskCategory;
  subcategory?: HealthSubcategory | 'none';
  title: string;
  name?: string;
  description?: string;
  /**
   * Full ISO timestamp for due datetime returned by backend.
   */
  dueAt?: string;
  timezone?: string | null;
  date: string; // ISO date
  time?: string; // ISO time string
  frequency: TaskFrequency;
  assignedTo?: string; // User ID
  assignedBy?: string;
  createdBy?: string;
  audience?: 'PARENT_TASK' | 'EMPLOYEE_TASK';
  source?: string;
  reminderEnabled: boolean;
  reminderOffsetMinutes?: number;
  reminderOptions: ReminderOption | null;
  syncWithCalendar: boolean;
  calendarProvider?: string;
  calendarEventId?: string | null;
  attachDocuments: boolean;
  attachments: TaskAttachment[];
  additionalNote?: string;
  status: TaskStatus;
  completedAt?: string; // ISO datetime
  statusUpdatedAt?: string;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
  details: TaskSpecificDetails;
  observationToolId?: string | null;
  appointmentId?: string | null;
  otSubmissionId?: string | null;
}

// Task Attachment
export interface TaskAttachment {
  id: string;
  name?: string;
  uri?: string;
  type?: string;
  size?: number;
  key?: string;
  downloadUrl?: string | null;
  viewUrl?: string | null;
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
  calendarProvider: string | null;
  calendarProviderName: string | null;
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
  observationalTool: string | null;
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
