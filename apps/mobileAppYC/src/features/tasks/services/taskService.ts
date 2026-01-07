import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {getFreshStoredTokens, isTokenExpired} from '@/features/auth/sessionManager';
import {buildCdnUrlFromKey} from '@/shared/utils/cdnHelpers';
import {resolveObservationToolIdSync} from '@/features/observationalTools/services/observationToolService';
import type {
  Task,
  TaskAttachment,
  TaskBackendCategory,
  TaskStatus,
  TaskStatusApi,
  RecurrenceType,
  TaskFormData,
} from '@/features/tasks/types';
import {formatDateToISODate, formatTimeToISO, formatEndDateToISO} from '@/features/tasks/utils/taskBuilder';

export interface TaskDraftPayload {
  companionId: string;
  category: TaskBackendCategory;
  name: string;
  description?: string;
  dueAt: string;
  timezone?: string | null;
  audience?: 'PARENT_TASK' | 'EMPLOYEE_TASK';
  assignedTo?: string;
  calendarEventId?: string | null;
  calendarProvider?: string | null;
  recurrence?: {
    type: RecurrenceType;
    endDate?: string | null;
    cronExpression?: string | null;
  } | null;
  reminder?: {
    enabled: boolean;
    offsetMinutes: number;
  } | null;
  syncWithCalendar?: boolean;
  attachments?: TaskAttachment[];
  medication?: {
    name?: string;
    type?: string;
    dosage?: string;
    frequency?: string;
  } | null;
  observationToolId?: string | null;
}

const ensureAccessToken = async (): Promise<{accessToken: string; userId?: string}> => {
  const tokens = await getFreshStoredTokens();
  const accessToken = tokens?.accessToken;
  const userId = tokens?.userId;

  if (!accessToken) {
    throw new Error('Missing access token. Please sign in again.');
  }

  if (isTokenExpired(tokens?.expiresAt ?? undefined)) {
    throw new Error('Your session expired. Please sign in again.');
  }

  return {accessToken, userId};
};

const resolveDateParts = (dueAt?: string | null): {date: string; time?: string} => {
  if (!dueAt) {
    const today = new Date();
    return {
      date: formatDateToISODate(today) ?? today.toISOString().split('T')[0],
      time: undefined,
    };
  }

  const dt = new Date(dueAt);
  if (Number.isNaN(dt.getTime())) {
    const today = new Date();
    return {
      date: formatDateToISODate(today) ?? today.toISOString().split('T')[0],
      time: undefined,
    };
  }

  return {
    date: formatDateToISODate(dt) ?? dt.toISOString().split('T')[0],
    time: formatTimeToISO(dt) ?? undefined,
  };
};

const mapReminderOptionFromOffset = (offsetMinutes?: number | null): Task['reminderOptions'] => {
  if (offsetMinutes == null) return null;
  const mapping: Record<number, Task['reminderOptions']> = {
    5: '5-mins-prior',
    30: '30-mins-prior',
    60: '1-hour-prior',
    720: '12-hours-prior',
    1440: '1-day-prior',
    4320: '3-days-prior',
  };
  return mapping[offsetMinutes] ?? null;
};

const mapReminderOptionToOffset = (option: TaskFormData['reminderOptions']): number | null => {
  const mapping: Record<string, number> = {
    '5-mins-prior': 5,
    '30-mins-prior': 30,
    '1-hour-prior': 60,
    '12-hours-prior': 720,
    '1-day-prior': 1440,
    '3-days-prior': 4320,
  };
  if (!option) return null;
  return mapping[option] ?? null;
};

const mapBackendCategoryToUi = (category?: string): Task['category'] => {
  switch (category) {
    case 'MEDICATION':
    case 'OBSERVATION_TOOL':
      return 'health';
    case 'HYGIENE':
      return 'hygiene';
    case 'DIET':
      return 'dietary';
    default:
      return 'custom';
  }
};

const mapRecurrenceToFrequency = (recurrence?: {type?: RecurrenceType}): Task['frequency'] => {
  switch (recurrence?.type) {
    case 'DAILY':
      return 'daily';
    case 'WEEKLY':
      return 'weekly';
    case 'CUSTOM':
      return 'daily';
    default:
      return 'once';
  }
};

const mapFrequencyToRecurrence = (frequency?: TaskFormData['frequency'] | TaskFormData['medicationFrequency']): RecurrenceType => {
  if (!frequency) return 'ONCE';
  const freq = frequency.toString().toLowerCase();
  if (freq === 'daily' || freq === 'every-day') return 'DAILY';
  if (freq === 'weekly') return 'WEEKLY';
  if (freq === 'monthly') return 'WEEKLY'; // Note: Backend RecurrenceType doesn't have MONTHLY, using WEEKLY as placeholder
  if (freq === 'once') return 'ONCE';
  return 'ONCE';
};

const normalizeAttachment = (att: any): TaskAttachment => {
  const keyFromId =
    typeof att?.id === 'string' && att.id.includes('/')
      ? att.id
      : undefined;
  const key =
    att?.key ??
    keyFromId ??
    att?.id ??
    att?._id ??
    att?.name;
  const name = att?.name ?? att?.fileName ?? key ?? 'attachment';
  const guessMimeFromName = (fileName?: string | null): string | undefined => {
    if (!fileName || typeof fileName !== 'string') return undefined;
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.doc')) return 'application/msword';
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return undefined;
  };

  const cdnUrl = buildCdnUrlFromKey(key) ?? undefined;
  const uri = att?.uri ?? att?.url ?? cdnUrl;

  return {
    id: key || name,
    key: key || undefined,
    name,
    uri,
    downloadUrl: att?.downloadUrl ?? uri ?? cdnUrl ?? null,
    viewUrl: att?.viewUrl ?? uri ?? cdnUrl ?? null,
    type: att?.type ?? guessMimeFromName(name),
    size: att?.size,
  };
};

const formatDoseTime = (value?: string | null): string | undefined => {
  if (!value) return undefined;

  // If ISO date-time string, convert to HH:mm in local time
  if (value.includes('T')) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }

  // If already in HH:mm or HH:mm:ss format
  if (value.includes(':')) {
    const [hh, mm] = value.split(':');
    if (hh && mm) {
      return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
    }
  }

  return undefined;
};

export const mapApiTaskToTask = (apiTask: any): Task => {
  const id = apiTask?._id ?? apiTask?.id ?? `task-${Date.now()}`;
  const dueAt = apiTask?.dueAt ?? apiTask?.due_at;
  const {date, time} = resolveDateParts(dueAt);
  const status: TaskStatus = (apiTask?.status as TaskStatusApi) ?? 'PENDING';
  const reminder = apiTask?.reminder;
  const reminderOption = mapReminderOptionFromOffset(reminder?.offsetMinutes);

  const attachmentList: TaskAttachment[] = Array.isArray(apiTask?.attachments)
    ? apiTask.attachments.map(normalizeAttachment)
    : [];

  const medication = apiTask?.medication;
  const recurrence = apiTask?.recurrence;
  const frequency = mapRecurrenceToFrequency(recurrence);

  return {
    id,
    companionId: apiTask?.companionId ?? apiTask?.companion_id ?? '',
    backendCategory: apiTask?.category,
    category: mapBackendCategoryToUi(apiTask?.category),
    subcategory: 'none',
    title: apiTask?.name ?? apiTask?.title ?? 'Task',
    name: apiTask?.name,
    description: apiTask?.description,
    dueAt: dueAt ?? undefined,
    timezone: apiTask?.timezone,
    date,
    time,
    frequency,
    assignedTo: apiTask?.assignedTo ?? apiTask?.assigned_to,
    assignedBy: apiTask?.assignedBy,
    createdBy: apiTask?.createdBy,
    audience: apiTask?.audience,
    source: apiTask?.source,
    reminderEnabled: Boolean(reminder?.enabled),
    reminderOffsetMinutes: reminder?.offsetMinutes,
    reminderOptions: reminderOption,
    syncWithCalendar: Boolean(apiTask?.syncWithCalendar),
    calendarProvider: apiTask?.calendarProvider ?? apiTask?.calendar_provider ?? null,
    calendarEventId: apiTask?.calendarEventId ?? apiTask?.calendar_event_id ?? null,
    attachDocuments: attachmentList.length > 0,
    attachments: attachmentList,
    additionalNote: undefined,
    status,
    statusUpdatedAt: apiTask?.updatedAt,
    completedAt: apiTask?.completedAt,
    createdAt: apiTask?.createdAt ?? new Date().toISOString(),
    updatedAt: apiTask?.updatedAt ?? new Date().toISOString(),
    observationToolId: resolveObservationToolIdSync(apiTask?.observationToolId ?? null),
    appointmentId: apiTask?.appointmentId ?? null,
    otSubmissionId: apiTask?.otSubmissionId ?? null,
    details: (() => {
      if (apiTask?.category === 'MEDICATION' || apiTask?.medication) {
        const doses = Array.isArray(medication?.doses) ? medication.doses : [];
        const formattedDosages =
          doses.length > 0
            ? doses.map((dose: any, index: number) => ({
                id: dose?.id ?? `dose-${index + 1}`,
                label: dose?.dosage ?? dose?.label ?? medication?.dosage ?? `Dose ${index + 1}`,
                time: formatDoseTime(dose?.time ?? time ?? formatTimeToISO(new Date(dueAt))),
              }))
            : (() => {
                const timeIso = time || formatTimeToISO(new Date(dueAt));
                return timeIso
                  ? [
                      {
                        id: 'dose-1',
                        label: medication?.dosage ?? 'Dose',
                        time: formatDoseTime(timeIso),
                      },
                    ]
                  : [];
              })();

        // Convert end date to full ISO format for calendar recurrence
        const endDateISO = recurrence?.endDate
          ? (() => {
              try {
                const endDate = new Date(recurrence.endDate);
                if (Number.isNaN(endDate.getTime())) return undefined;
                // Set to end of day if time is not included
                if (endDate.getHours() === 0 && endDate.getMinutes() === 0) {
                  endDate.setHours(23, 59, 59, 999);
                }
                return endDate.toISOString();
              } catch {
                return undefined;
              }
            })()
          : undefined;

        return {
          taskType: 'give-medication',
          medicineName: medication?.name ?? '',
          medicineType: medication?.type ?? '',
          dosages: formattedDosages,
          frequency: medication?.frequency ?? frequency,
          startDate: date,
          endDate: endDateISO,
          description: apiTask?.description ?? '',
        };
      }

      if (apiTask?.category === 'OBSERVATION_TOOL' || apiTask?.observationToolId) {
        const resolvedToolId = resolveObservationToolIdSync(apiTask?.observationToolId ?? null);
        return {
          taskType: 'take-observational-tool',
          toolType: resolvedToolId ?? apiTask?.observationToolId ?? 'observational-tool',
          chronicConditionType: apiTask?.chronicConditionType,
        };
      }

      return {
        description: apiTask?.description,
      };
    })(),
  };
};

export const buildTaskDraftFromForm = ({
  formData,
  companionId,
  observationToolId,
}: {
  formData: TaskFormData;
  companionId: string;
  observationToolId?: string | null;
}): TaskDraftPayload => {
  const taskDate = formData.date || formData.startDate || new Date();
  const formattedDate =
    formatDateToISODate(taskDate) || taskDate.toISOString().split('T')[0];
  const formattedTime =
    formData.time ? formatTimeToISO(formData.time) : undefined;
  const dueAt = new Date(`${formattedDate}T${formattedTime ?? '00:00:00'}`).toISOString();
  const timezone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    } catch {
      return null;
    }
  })();

  const reminderOffsetMinutes = mapReminderOptionToOffset(formData.reminderOptions);

  // For medication tasks, prioritize medicationFrequency over frequency
  const selectedFrequency = formData.medicationFrequency || formData.frequency;
  const recurrenceType = mapFrequencyToRecurrence(selectedFrequency);

  console.log('[TaskService] Building task draft:', {
    medicationFrequency: formData.medicationFrequency,
    frequency: formData.frequency,
    selectedFrequency,
    recurrenceType,
  });

  let category: TaskBackendCategory;
  if (formData.healthTaskType === 'take-observational-tool') {
    category = 'OBSERVATION_TOOL';
  } else if (formData.healthTaskType === 'give-medication') {
    category = 'MEDICATION';
  } else if (formData.category === 'hygiene') {
    category = 'HYGIENE';
  } else if (formData.category === 'dietary') {
    category = 'DIET';
  } else {
    category = 'CUSTOM';
  }

  const attachments: TaskAttachment[] = (formData.attachments || []).map(att => normalizeAttachment(att));

  return {
    companionId,
    category,
    name: formData.title || formData.description || 'Task',
    description: formData.description || undefined,
    dueAt,
    timezone,
    audience: 'PARENT_TASK',
    assignedTo: formData.assignedTo || undefined,
    recurrence: {
      type: recurrenceType,
      endDate: formData.endDate ? formatEndDateToISO(formData.endDate) : undefined,
      cronExpression: undefined,
    },
    calendarEventId: undefined,
    calendarProvider: formData.calendarProvider || undefined,
    reminder: (() => {
      if (!formData.reminderEnabled) return null;
      if (reminderOffsetMinutes != null) {
        return {enabled: true, offsetMinutes: reminderOffsetMinutes};
      }
      return {enabled: true, offsetMinutes: 30};
    })(),
    syncWithCalendar: formData.syncWithCalendar,
    attachments,
    medication:
      category === 'MEDICATION'
        ? ({
            name: formData.medicineName,
            type: formData.medicineType ?? undefined,
            doses:
              formData.dosages?.length
                ? formData.dosages.map((dose, index) => {
                    const hhmm = formatDoseTime(dose.time);
                    return {
                      dosage: dose.label || `Dose ${index + 1}`,
                      time: hhmm,
                    };
                  })
                : undefined,
            dosage: undefined,
            frequency:
              (formData.medicationFrequency
                ? formData.medicationFrequency.toUpperCase()
                : recurrenceType) ?? undefined,
          } as any)
        : null,
    observationToolId:
      category === 'OBSERVATION_TOOL'
        ? resolveObservationToolIdSync(observationToolId ?? formData.observationalTool ?? null)
        : null,
  };
};

export const taskApi = {
  async list(params?: {companionId?: string; status?: TaskStatusApi[]}) {
    const {accessToken, userId} = await ensureAccessToken();
    const response = await apiClient.get('/v1/task/mobile/task', {
      params: {
        companionId: params?.companionId,
        status: params?.status?.join(','),
      },
      headers: {
        ...withAuthHeaders(accessToken),
        ...(userId ? {'x-user-id': userId} : {}),
      },
    });
    const data = Array.isArray(response.data) ? response.data : [];
    return data.map(mapApiTaskToTask);
  },

  async get(taskId: string) {
    const {accessToken, userId} = await ensureAccessToken();
    const response = await apiClient.get(`/v1/task/mobile/${taskId}`, {
      headers: {
        ...withAuthHeaders(accessToken),
        ...(userId ? {'x-user-id': userId} : {}),
      },
    });
    return mapApiTaskToTask(response.data);
  },

  async create(payload: TaskDraftPayload) {
    const {accessToken, userId} = await ensureAccessToken();
    const response = await apiClient.post('/v1/task/mobile/', payload, {
      headers: {
        ...withAuthHeaders(accessToken),
        ...(userId ? {'x-user-id': userId} : {}),
      },
    });
    return mapApiTaskToTask(response.data);
  },

  async update(taskId: string, updates: Partial<TaskDraftPayload>) {
    const {accessToken, userId} = await ensureAccessToken();
    const response = await apiClient.patch(`/v1/task/mobile/${taskId}`, updates, {
      headers: {
        ...withAuthHeaders(accessToken),
        ...(userId ? {'x-user-id': userId} : {}),
      },
    });
    return mapApiTaskToTask(response.data);
  },

  async changeStatus(taskId: string, status: TaskStatusApi, completion?: any) {
    const {accessToken, userId} = await ensureAccessToken();
    const response = await apiClient.post(
      `/v1/task/mobile/${taskId}/status`,
      completion ? {status, completion} : {status},
      {
        headers: {
          ...withAuthHeaders(accessToken),
          ...(userId ? {'x-user-id': userId} : {}),
        },
      },
    );
    const task = response.data?.task ?? response.data;
    return mapApiTaskToTask(task);
  },
};
