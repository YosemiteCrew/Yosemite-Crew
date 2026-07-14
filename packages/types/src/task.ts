import type { Bundle, CodeableConcept, Extension, Reference, Task } from '@yosemite-crew/fhir';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskAudience = 'EMPLOYEE_TASK' | 'PARENT_TASK';
export type TaskSource = 'YC_LIBRARY' | 'ORG_TEMPLATE' | 'CUSTOM';
export type TaskKind =
  | 'MEDICATION'
  | 'OBSERVATION_TOOL'
  | 'HYGIENE'
  | 'DIET'
  | 'CUSTOM'
  | 'CARE'
  | 'PROCEDURE'
  | 'DIAGNOSTIC'
  | 'COMMUNICATION'
  | 'BILLING'
  | 'RECORD'
  | 'ADMIN';
export type TaskCategory =
  | 'MEDICATION'
  | 'CARE'
  | 'DIET'
  | 'PROCEDURE'
  | 'DIAGNOSTIC'
  | 'COMMUNICATION'
  | 'BILLING'
  | 'RECORD'
  | 'ADMIN'
  | 'CUSTOM';

export const TASK_KIND_TAXONOMY: readonly TaskKind[] = [
  'MEDICATION',
  'OBSERVATION_TOOL',
  'HYGIENE',
  'DIET',
  'CUSTOM',
  'CARE',
  'PROCEDURE',
  'DIAGNOSTIC',
  'COMMUNICATION',
  'BILLING',
  'RECORD',
  'ADMIN',
] as const;

export const TASK_CATEGORY_TAXONOMY: readonly TaskCategory[] = [
  'MEDICATION',
  'CARE',
  'DIET',
  'PROCEDURE',
  'DIAGNOSTIC',
  'COMMUNICATION',
  'BILLING',
  'RECORD',
  'ADMIN',
  'CUSTOM',
] as const;

export const isTaskCategory = (value: string): value is TaskCategory =>
  TASK_CATEGORY_TAXONOMY.includes(value as TaskCategory);

export const isTaskKind = (value: string): value is TaskKind =>
  TASK_KIND_TAXONOMY.includes(value as TaskKind);

export interface MedicationDoseInput {
  time?: string;
  dosage?: string;
  instructions?: string;
}

export interface MedicationInput {
  name?: string;
  type?: string;
  notes?: string;
  frequency?: string;
  doses?: MedicationDoseInput[];
}

export interface TaskLike {
  id: string;
  organisationId: string | null;
  appointmentId: string | null;
  patientId: string | null;
  companionId?: string | null;
  createdBy: string;
  assignedBy: string | null;
  assignedTo: string;
  assignedGroupId: string | null;
  audience: TaskAudience;
  source: TaskSource | string;
  libraryTaskId: string | null;
  templateId: string | null;
  category: string;
  subcategory: string | null;
  name: string;
  description: string | null;
  additionalNotes: string | null;
  medication: unknown;
  observationToolId: string | null;
  dueAt: Date;
  timezone: string | null;
  recurrence: unknown;
  reminder: unknown;
  syncWithCalendar: boolean | null;
  calendarEventId: string | null;
  attachments: unknown;
  status: TaskStatus;
  completedAt: Date | null;
  completedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomTaskInput {
  organisationId: string;
  appointmentId?: string;
  patientId?: string;
  companionId?: string;
  createdBy: string;
  assignedBy?: string;
  assignedTo: string;
  assignedGroupId?: string | null;
  audience: TaskAudience;
  source?: TaskSource;
  libraryTaskId?: string;
  templateId?: string;
  category: string;
  subcategory?: string;
  name: string;
  description?: string;
  additionalNotes?: string;
  medication?: MedicationInput;
  observationToolId?: string;
  dueAt: Date;
  timezone?: string;
  recurrence?: {
    type: 'ONCE' | 'DAILY' | 'WEEKLY' | 'CUSTOM';
    endDate?: Date;
    cronExpression?: string;
  };
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
  };
  syncWithCalendar?: boolean;
  attachments?: {
    id: string;
    name: string;
  }[];
}

export interface TaskUpdateInput {
  name?: string;
  description?: string;
  additionalNotes?: string;
  dueAt?: Date;
  timezone?: string | null;
  assignedTo?: string;
  assignedGroupId?: string | null;
  medication?: MedicationInput | null;
  observationToolId?: string | null;
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
  } | null;
  syncWithCalendar?: boolean;
  attachments?: {
    id: string;
    name: string;
  }[];
  recurrence?: {
    type: 'ONCE' | 'DAILY' | 'WEEKLY' | 'CUSTOM';
    endDate?: Date | null;
    cronExpression?: string | null;
  } | null;
}

export interface TaskListFilters {
  organisationId?: string;
  appointmentId?: string;
  encounterId?: string;
  episodeOfCareId?: string;
  admissionId?: string;
  companionId?: string;
  clientId?: string;
  templateInstanceId?: string;
  scheduleId?: string;
  audience?: TaskAudience;
  assignedTo?: string;
  assignedRole?: TaskAudience;
  status?: TaskStatus[];
  category?: TaskCategory;
  subcategory?: string;
  kind?: TaskKind;
  dueFrom?: Date;
  dueTo?: Date;
  includeCompleted?: boolean;
}

const TASK_AUDIENCE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-audience';
const TASK_SOURCE_EXTENSION_URL = 'https://yosemitecrew.com/fhir/StructureDefinition/task-source';
const TASK_TEMPLATE_ID_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-template-id';
const TASK_LIBRARY_ID_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-library-id';
const TASK_ORGANISATION_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-organisation';
const TASK_APPOINTMENT_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-appointment';
const TASK_COMPANION_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-companion';
const TASK_CREATED_BY_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-created-by';
const TASK_ASSIGNED_BY_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-assigned-by';
const TASK_ASSIGNED_TO_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-assigned-to';
const TASK_ASSIGNED_GROUP_ID_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-assigned-group-id';
const TASK_CATEGORY_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-category';
const TASK_DUE_AT_EXTENSION_URL = 'https://yosemitecrew.com/fhir/StructureDefinition/task-due-at';
const TASK_TIMEZONE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-timezone';
const TASK_MEDICATION_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-medication';
const TASK_OBSERVATION_TOOL_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-observation-tool';
const TASK_RECURRENCE_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-recurrence';
const TASK_REMINDER_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-reminder';
const TASK_SYNC_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-sync-with-calendar';
const TASK_ATTACHMENTS_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/task-attachments';

const parseJson = <T>(value: unknown): T | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'object') {
    return value as T;
  }
  return undefined;
};

const getExtension = (extensions: Extension[] | undefined, url: string) =>
  extensions?.find((extension) => extension.url === url);

const getStringExtension = (extensions: Extension[] | undefined, url: string) =>
  getExtension(extensions, url)?.valueString;

const getDateTimeExtension = (extensions: Extension[] | undefined, url: string) => {
  const extension = getExtension(extensions, url);
  return extension?.valueDateTime ?? extension?.valueString;
};

const getBooleanExtension = (extensions: Extension[] | undefined, url: string) =>
  getExtension(extensions, url)?.valueBoolean;

const normalizeReferenceId = (reference?: Reference | null) => {
  const ref = reference?.reference;
  if (!ref) return undefined;
  return ref.split('/').pop() ?? undefined;
};

const statusToFhir = (status: TaskStatus): Task['status'] => {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    case 'IN_PROGRESS':
      return 'accepted';
    case 'PENDING':
    default:
      return 'requested';
  }
};

const fhirToStatus = (status?: string): TaskStatus => {
  switch (status) {
    case 'completed':
      return 'COMPLETED';
    case 'cancelled':
    case 'entered-in-error':
    case 'stopped':
      return 'CANCELLED';
    case 'accepted':
    case 'in-progress':
      return 'IN_PROGRESS';
    default:
      return 'PENDING';
  }
};

const audienceFromExtension = (extensions: Extension[] | undefined): TaskAudience | undefined => {
  const value = getStringExtension(extensions, TASK_AUDIENCE_EXTENSION_URL);
  return value === 'PARENT_TASK' || value === 'EMPLOYEE_TASK' ? value : undefined;
};

const toCodeableConcept = (code: string, display?: string): CodeableConcept => ({
  coding: [
    {
      system: 'https://yosemitecrew.com/fhir/CodeSystem/task-category',
      code,
      display: display ?? code,
    },
  ],
  text: display ?? code,
});

const taskExtensions = (task: TaskLike): Extension[] => {
  const extensions: Extension[] = [
    { url: TASK_AUDIENCE_EXTENSION_URL, valueString: task.audience },
    { url: TASK_SOURCE_EXTENSION_URL, valueString: String(task.source) },
    { url: TASK_CREATED_BY_EXTENSION_URL, valueString: task.createdBy },
    { url: TASK_ASSIGNED_BY_EXTENSION_URL, valueString: task.assignedBy ?? undefined },
    { url: TASK_ASSIGNED_TO_EXTENSION_URL, valueString: task.assignedTo },
    { url: TASK_CATEGORY_EXTENSION_URL, valueString: task.category },
    { url: TASK_DUE_AT_EXTENSION_URL, valueDateTime: task.dueAt.toISOString() },
  ];

  if (task.assignedGroupId) {
    extensions.push({
      url: TASK_ASSIGNED_GROUP_ID_EXTENSION_URL,
      valueString: task.assignedGroupId,
    });
  }

  if (task.organisationId) {
    extensions.push({
      url: TASK_ORGANISATION_EXTENSION_URL,
      valueString: task.organisationId,
    });
  }

  if (task.appointmentId) {
    extensions.push({
      url: TASK_APPOINTMENT_EXTENSION_URL,
      valueString: task.appointmentId,
    });
  }

  const patientId = task.patientId ?? task.companionId;

  if (patientId) {
    extensions.push({
      url: TASK_COMPANION_EXTENSION_URL,
      valueString: patientId,
    });
  }

  if (task.templateId) {
    extensions.push({
      url: TASK_TEMPLATE_ID_EXTENSION_URL,
      valueString: task.templateId,
    });
  }

  if (task.libraryTaskId) {
    extensions.push({
      url: TASK_LIBRARY_ID_EXTENSION_URL,
      valueString: task.libraryTaskId,
    });
  }

  if (task.timezone) {
    extensions.push({
      url: TASK_TIMEZONE_EXTENSION_URL,
      valueString: task.timezone,
    });
  }

  if (task.medication) {
    extensions.push({
      url: TASK_MEDICATION_EXTENSION_URL,
      valueString: JSON.stringify(task.medication),
    });
  }

  if (task.observationToolId) {
    extensions.push({
      url: TASK_OBSERVATION_TOOL_EXTENSION_URL,
      valueString: task.observationToolId,
    });
  }

  if (task.recurrence) {
    extensions.push({
      url: TASK_RECURRENCE_EXTENSION_URL,
      valueString: JSON.stringify(task.recurrence),
    });
  }

  if (task.reminder) {
    extensions.push({
      url: TASK_REMINDER_EXTENSION_URL,
      valueString: JSON.stringify(task.reminder),
    });
  }

  if (task.syncWithCalendar !== null && task.syncWithCalendar !== undefined) {
    extensions.push({
      url: TASK_SYNC_EXTENSION_URL,
      valueBoolean: task.syncWithCalendar,
    });
  }

  if (task.attachments) {
    extensions.push({
      url: TASK_ATTACHMENTS_EXTENSION_URL,
      valueString: JSON.stringify(task.attachments),
    });
  }

  return extensions;
};

const taskToFhir = (task: TaskLike): Task => {
  const patientId = task.patientId ?? task.companionId;

  return {
    resourceType: 'Task',
    id: task.id,
    status: statusToFhir(task.status),
    intent: 'order',
    description: task.description ?? task.name,
    focus: task.templateId ? { reference: `PlanDefinition/${task.templateId}` } : undefined,
    for: patientId ? { reference: `Patient/${patientId}` } : undefined,
    owner: { reference: `Practitioner/${task.assignedTo}` },
    authoredOn: task.createdAt.toISOString(),
    lastModified: task.updatedAt.toISOString(),
    executionPeriod: { start: task.dueAt.toISOString() },
    basedOn: task.appointmentId ? [{ reference: `Appointment/${task.appointmentId}` }] : undefined,
    code: {
      coding: [
        {
          system: 'https://yosemitecrew.com/fhir/CodeSystem/task-category',
          code: task.category,
          display: task.category,
        },
      ],
      text: task.category,
    },
    extension: taskExtensions(task),
  };
};

const taskFromFhir = (
  task: Task,
  defaults?: {
    organisationId?: string;
    createdBy: string;
    assignedBy?: string;
    assignedTo?: string;
  }
): CreateCustomTaskInput => {
  const extensions = task.extension;
  const assignedTo =
    normalizeReferenceId(task.owner) ??
    getStringExtension(extensions, TASK_ASSIGNED_TO_EXTENSION_URL) ??
    defaults?.assignedTo ??
    '';
  const dueAtExtension = getDateTimeExtension(extensions, TASK_DUE_AT_EXTENSION_URL);
  const dueAt = dueAtExtension ? new Date(dueAtExtension) : new Date();
  const description = task.description ?? task.code?.text ?? '';

  return {
    organisationId:
      getStringExtension(extensions, TASK_ORGANISATION_EXTENSION_URL) ??
      defaults?.organisationId ??
      '',
    appointmentId: getStringExtension(extensions, TASK_APPOINTMENT_EXTENSION_URL) ?? undefined,
    patientId: getStringExtension(extensions, TASK_COMPANION_EXTENSION_URL) ?? undefined,
    companionId: getStringExtension(extensions, TASK_COMPANION_EXTENSION_URL) ?? undefined,
    createdBy:
      getStringExtension(extensions, TASK_CREATED_BY_EXTENSION_URL) ?? defaults?.createdBy ?? '',
    assignedBy:
      getStringExtension(extensions, TASK_ASSIGNED_BY_EXTENSION_URL) ?? defaults?.assignedBy,
    assignedTo,
    assignedGroupId:
      getStringExtension(extensions, TASK_ASSIGNED_GROUP_ID_EXTENSION_URL) ?? undefined,
    audience: audienceFromExtension(extensions) ?? 'EMPLOYEE_TASK',
    source:
      (getStringExtension(extensions, TASK_SOURCE_EXTENSION_URL) as TaskSource | undefined) ??
      'CUSTOM',
    libraryTaskId: getStringExtension(extensions, TASK_LIBRARY_ID_EXTENSION_URL) ?? undefined,
    templateId: getStringExtension(extensions, TASK_TEMPLATE_ID_EXTENSION_URL) ?? undefined,
    category:
      getStringExtension(extensions, TASK_CATEGORY_EXTENSION_URL) ??
      task.code?.coding?.[0]?.code ??
      description,
    name: description || task.code?.text || 'Task',
    description,
    additionalNotes: undefined,
    medication: parseJson<MedicationInput>(
      getStringExtension(extensions, TASK_MEDICATION_EXTENSION_URL)
    ),
    observationToolId:
      getStringExtension(extensions, TASK_OBSERVATION_TOOL_EXTENSION_URL) ?? undefined,
    dueAt: Number.isNaN(dueAt.getTime()) ? new Date() : dueAt,
    timezone: getStringExtension(extensions, TASK_TIMEZONE_EXTENSION_URL) ?? undefined,
    recurrence: parseJson<CreateCustomTaskInput['recurrence']>(
      getStringExtension(extensions, TASK_RECURRENCE_EXTENSION_URL)
    ),
    reminder: parseJson<CreateCustomTaskInput['reminder']>(
      getStringExtension(extensions, TASK_REMINDER_EXTENSION_URL)
    ),
    syncWithCalendar: getBooleanExtension(extensions, TASK_SYNC_EXTENSION_URL) ?? undefined,
    attachments: parseJson<CreateCustomTaskInput['attachments']>(
      getStringExtension(extensions, TASK_ATTACHMENTS_EXTENSION_URL)
    ),
  };
};

const taskUpdateInputFromFhir = (task: Task): TaskUpdateInput => ({
  name: task.description ?? undefined,
  description: task.description ?? undefined,
  dueAt: (() => {
    const value = getDateTimeExtension(task.extension, TASK_DUE_AT_EXTENSION_URL);
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  })(),
  timezone: getStringExtension(task.extension, TASK_TIMEZONE_EXTENSION_URL) ?? undefined,
  assignedTo: normalizeReferenceId(task.owner),
  assignedGroupId:
    getStringExtension(task.extension, TASK_ASSIGNED_GROUP_ID_EXTENSION_URL) ?? undefined,
  medication: parseJson<MedicationInput>(
    getStringExtension(task.extension, TASK_MEDICATION_EXTENSION_URL)
  ),
  observationToolId:
    getStringExtension(task.extension, TASK_OBSERVATION_TOOL_EXTENSION_URL) ?? undefined,
  reminder: parseJson<TaskUpdateInput['reminder']>(
    getStringExtension(task.extension, TASK_REMINDER_EXTENSION_URL)
  ),
  syncWithCalendar: getBooleanExtension(task.extension, TASK_SYNC_EXTENSION_URL) ?? undefined,
  attachments: parseJson<TaskUpdateInput['attachments']>(
    getStringExtension(task.extension, TASK_ATTACHMENTS_EXTENSION_URL)
  ),
  recurrence: parseJson<TaskUpdateInput['recurrence']>(
    getStringExtension(task.extension, TASK_RECURRENCE_EXTENSION_URL)
  ),
});

const listBundle = (tasks: TaskLike[]): Bundle => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total: tasks.length,
  entry: tasks.map((task) => ({
    resource: taskToFhir(task),
  })),
});

export const taskFhirMapper = {
  toFhirTask: taskToFhir,
  fromFhirTask: taskFromFhir,
  toTaskUpdateInput: taskUpdateInputFromFhir,
  fromTaskStatus: fhirToStatus,
  toTaskStatus: statusToFhir,
  listBundle,
};
