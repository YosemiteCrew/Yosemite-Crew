import { FilterOption, StatusOption } from "../pages/Companions/types";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type RecurrenceType = "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
export type TaskKind =
  | "MEDICATION"
  | "OBSERVATION_TOOL"
  | "HYGIENE"
  | "DIET"
  | "CUSTOM";

export const TaskRecurrenceOptions = [
  { label: "Once", value: "ONCE" },
  { label: "Daily", value: "DAILY" },
  { label: "Weekly", value: "WEEKLY" },
];

export const TaskKindOptions = [
  { label: "Medication", value: "MEDICATION" },
  { label: "Observation Tool", value: "OBSERVATION_TOOL" },
  { label: "Hygiene", value: "HYGIENE" },
  { label: "Diet", value: "DIET" },
  { label: "Custom", value: "CUSTOM" },
];

export const TaskStatusOptions = [
  { label: "Pending", value: "PENDING" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export type Task = {
  _id: string;
  organisationId?: string;
  appointmentId?: string;
  companionId?: string;
  createdBy?: string;
  assignedBy?: string;
  assignedTo: string;
  audience: "EMPLOYEE_TASK" | "PARENT_TASK";
  source: "YC_LIBRARY" | "ORG_TEMPLATE" | "CUSTOM";
  libraryTaskId?: string;
  templateId?: string;
  category: string;
  name: string;
  description?: string;
  additionalNotes?: string;
  medication?: {
    name?: string;
    type?: string;
    notes?: string;
    doses?: {
      dosage?: string;
      time?: string;
      frequency?: string;
    }[];
  };
  observationToolId?: string;
  dueAt: Date;
  timezone?: string;
  recurrence?: {
    type: RecurrenceType;
    isMaster: boolean;
    masterTaskId?: string;
    cronExpression?: string;
    endDate?: Date;
  };
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
    scheduledNotificationId?: string;
  };
  syncWithCalendar?: boolean;
  calendarEventId?: string;
  attachments?: {
    id: string;
    name: string;
  }[];
  status: TaskStatus;
  completedAt?: Date;
  completedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TaskTemplate = {
  _id: string;
  source: "ORG_TEMPLATE";
  organisationId: string;
  libraryTaskId?: string;
  category: string;
  name: string;
  description?: string;
  kind: TaskKind;
  defaultRole: "EMPLOYEE" | "PARENT";
  defaultMedication?: {
    name?: string;
    type?: string;
    dosage?: string;
    frequency?: string;
  };
  defaultObservationToolId?: string;
  defaultRecurrence?: {
    type: "ONCE" | "DAILY" | "WEEKLY" | "CUSTOM";
    customCron?: string;
    defaultEndOffsetDays?: number;
  };
  defaultReminderOffsetMinutes?: number;
  isActive: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TaskLibrary = {
  _id: string;
  source: "YC_LIBRARY";
  kind: TaskKind;
  category: string;
  name: string;
  defaultDescription?: string;
  schema: {
    medicationFields?: {
      hasMedicationName?: boolean;
      hasType?: boolean;
      hasDosage?: boolean;
      hasFrequency?: boolean;
    };
    requiresObservationTool?: boolean;
    allowsRecurrence?: boolean;
  };
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export const EMPTY_TASK: Task = {
  _id: "",
  assignedTo: "",
  audience: "EMPLOYEE_TASK",
  source: "CUSTOM",
  libraryTaskId: undefined,
  templateId: undefined,
  category: "MEDICATION",
  recurrence: {
    type: "ONCE",
    isMaster: false,
  },
  name: "",
  description: "",
  dueAt: new Date(),
  status: "PENDING",
};

export const TaskStatusFilters: StatusOption[] = [
  {
    name: "All",
    key: "all",
    bg: "#5C614B",
    text: "#fff",
  },
  {
    name: "Pending",
    key: "pending",
    bg: "#747283",
    text: "#fff",
  },
  {
    name: "In progress",
    key: "in_progress",
    bg: "#BF9FAA",
    text: "#fff",
  },
  {
    name: "Completed",
    key: "completed",
    bg: "#D28F9A",
    text: "#fff",
  },
  {
    name: "Cancelled",
    key: "cancelled",
    bg: "#D9A488",
    text: "#fff",
  },
];

export const TaskFilters: FilterOption[] = [
  {
    name: "All",
    key: "all",
  },
  {
    name: "Organizations",
    key: "employee_task",
  },
  {
    name: "Companions",
    key: "parent_task",
  },
];
