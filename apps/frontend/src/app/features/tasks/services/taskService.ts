import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { Task, TaskKind, TaskLibrary, TaskTemplate } from '@/app/features/tasks/types/task';
import type { RecurrenceScope } from '@/app/features/tasks/constants/taskTaxonomy';
import { deleteData, getData, patchData, postData, putData } from '@/app/services/axios';
import { loadTemplateForms } from '@/app/features/forms/services/templateFormsService';
import type { TemplateLike } from '@yosemite-crew/types';

type TaskStatusFilter = Task['status'] | Task['status'][];

export type TaskListFilters = {
  userId?: string;
  appointmentId?: string;
  encounterId?: string;
  episodeOfCareId?: string;
  admissionId?: string;
  companionId?: string;
  clientId?: string;
  templateInstanceId?: string;
  scheduleId?: string;
  audience?: Task['audience'];
  assignedTo?: string;
  assignedRole?: string;
  fromDueAt?: string | Date;
  toDueAt?: string | Date;
  dueFrom?: string | Date;
  dueTo?: string | Date;
  status?: TaskStatusFilter;
  category?: string;
  subcategory?: string;
  kind?: TaskKind;
  includeCompleted?: boolean;
};

export type CompanionTaskListFilters = Omit<TaskListFilters, 'userId' | 'companionId'> & {
  audience?: Task['audience'];
};

const toIsoQueryValue = (value: string | Date | undefined) => {
  if (value instanceof Date) return value.toISOString();
  return value;
};

const taskListQuery = (filters: TaskListFilters | CompanionTaskListFilters = {}) => {
  const status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
  return {
    ...filters,
    status,
    fromDueAt: toIsoQueryValue(filters.fromDueAt),
    toDueAt: toIsoQueryValue(filters.toDueAt),
    dueFrom: toIsoQueryValue(filters.dueFrom),
    dueTo: toIsoQueryValue(filters.dueTo),
  };
};

export const loadTasksForPrimaryOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
  filters?: TaskListFilters;
}): Promise<void> => {
  const { startLoading, status, taskIdsByOrgId, setTasksForOrg } = useTaskStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot load tasks.');
    return;
  }
  const hasOrgData = !taskIdsByOrgId || Object.hasOwn(taskIdsByOrgId, primaryOrgId);
  if (!shouldFetchTasks(status, hasOrgData, opts)) return;
  if (!opts?.silent) startLoading();
  try {
    const query = taskListQuery(opts?.filters);
    const hasQuery = Object.values(query).some((value) => value !== undefined && value !== '');
    const res = hasQuery
      ? await getData<Task[]>('/v1/task/pms/organisation/' + primaryOrgId, query)
      : await getData<Task[]>('/v1/task/pms/organisation/' + primaryOrgId);
    const tasks = res.data ?? [];
    setTasksForOrg(primaryOrgId, tasks);
  } catch (err) {
    console.error('Failed to load tasks:', err);
    throw err;
  }
};

export const getTasksForCompanion = async (
  companionId: string,
  filters: CompanionTaskListFilters = {}
): Promise<Task[]> => {
  if (!companionId) return [];
  const query = taskListQuery(filters);
  const hasQuery = Object.values(query).some((value) => value !== undefined && value !== '');
  const res = hasQuery
    ? await getData<Task[]>('/v1/task/pms/companion/' + companionId, query)
    : await getData<Task[]>('/v1/task/pms/companion/' + companionId);
  return res.data ?? [];
};

const shouldFetchTasks = (
  status: ReturnType<typeof useTaskStore.getState>['status'],
  hasOrgData: boolean,
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  if (!hasOrgData) return true;
  return status === 'idle' || status === 'error';
};

export const createTask = async (task: Task) => {
  const { upsertTask } = useTaskStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot create task.');
    return;
  }
  try {
    const payload: Task = {
      ...task,
      organisationId: primaryOrgId,
    };
    const type = task.source;
    const isCustomTask = type === 'CUSTOM';
    const isTemplateTask = type === 'ORG_TEMPLATE';
    const isLibraryTask = type === 'YC_LIBRARY';
    let route = '/v1/task/pms/';
    if (isCustomTask) {
      route = route + 'custom';
    } else if (isTemplateTask) {
      route = route + 'from-template';
    } else if (isLibraryTask) {
      route = route + 'from-library';
    } else {
      throw new Error('Invalid task source type: ' + type);
    }
    const res = await postData<Task>(route, payload);
    const normalTask = res.data;
    if (normalTask.audience === 'EMPLOYEE_TASK') {
      upsertTask(normalTask);
    }
  } catch (err) {
    console.error('Failed to create task:', err);
    throw err;
  }
};

export const createTaskTemplate = async (task: TaskTemplate) => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot create task.');
    return;
  }
  try {
    const payload: TaskTemplate = {
      ...task,
      organisationId: primaryOrgId,
    };
    await postData('/v1/task/pms/templates', payload);
  } catch (err) {
    console.error('Failed to create task:', err);
    throw err;
  }
};

export const getTaskTemplateById = async (templateId: string): Promise<TaskTemplate | null> => {
  if (!templateId) return null;
  const res = await getData<TaskTemplate>('/v1/task/pms/templates/' + templateId);
  return res.data;
};

export const updateTaskTemplate = async (
  templateId: string,
  patch: Partial<TaskTemplate>
): Promise<TaskTemplate | null> => {
  if (!templateId) return null;
  const res = await patchData<TaskTemplate>('/v1/task/pms/templates/' + templateId, patch);
  return res.data;
};

export const archiveTaskTemplate = async (templateId: string): Promise<void> => {
  if (!templateId) return;
  await deleteData('/v1/task/pms/templates/' + templateId);
};

/**
 * Update a task. For a task in a recurring series, an optional `scope` selects
 * which occurrences the edit applies to (THIS / THIS_AND_FOLLOWING / ALL); it is
 * sent as a `scope` query param. The backend ignores it until the series-scoped
 * contract ships (handoff), so a scoped edit safely degrades to a single-task
 * update — never an error.
 */
export const updateTask = async (payload: Task, scope?: RecurrenceScope) => {
  const { upsertTask } = useTaskStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot update task.');
    return;
  }
  if (!payload?._id) {
    console.warn('updateTask: missing id:', payload);
    return;
  }
  try {
    const res = await patchData<Task>(
      '/v1/task/pms/' + payload._id,
      payload,
      scope ? { params: { scope } } : undefined
    );
    const normalTask = res.data;
    upsertTask(normalTask);
  } catch (err) {
    console.error('Failed to update task:', err);
    throw err;
  }
};

/**
 * Delete a task. For a recurring series, `scope` selects which occurrences to
 * remove (sent as a `scope` query param). NOTE: the backend task-delete endpoint
 * does not exist yet (handoff) — this call will fail until it ships; callers
 * should surface the error rather than assume success.
 */
export const deleteTask = async (taskId: string, scope?: RecurrenceScope) => {
  const { removeTask } = useTaskStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot delete task.');
    return;
  }
  if (!taskId) {
    console.warn('deleteTask: missing id');
    return;
  }
  await deleteData('/v1/task/pms/' + taskId, scope ? { scope } : {});
  removeTask(taskId);
};

export const changeTaskStatus = async (task: Task) => {
  const { upsertTask, tasksById } = useTaskStore.getState();

  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot update task.');
    return;
  }
  if (!task?._id) {
    console.warn('updateTask: missing id:', task);
    return;
  }
  try {
    const existingTask = tasksById[task._id];
    // Keep task list responsive even if status API returns a partial entity.
    upsertTask({
      ...existingTask,
      ...task,
      organisationId: task.organisationId || existingTask?.organisationId || primaryOrgId,
    });

    const payload = {
      status: task.status,
    };
    const res = await postData<Task>('/v1/task/pms/' + task._id + '/status', payload);
    const normalTask = {
      ...(existingTask ?? ({} as Task)),
      ...task,
      ...(res.data ?? ({} as Task)),
      organisationId:
        res.data?.organisationId ||
        task.organisationId ||
        existingTask?.organisationId ||
        primaryOrgId,
    };
    upsertTask(normalTask);
  } catch (err) {
    console.error('Failed to update task:', err);
    throw err;
  }
};

export const getTaskTemplatesForPrimaryOrg = async (): Promise<TaskTemplate[]> => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot load companions.');
    return [];
  }
  try {
    const [legacyResult, templateResult] = await Promise.allSettled([
      getData<TaskTemplate[]>('/v1/task/pms/templates/organisation/' + primaryOrgId),
      loadTemplateForms(primaryOrgId, { kind: 'TASK_ASSIGNMENT', status: 'PUBLISHED' }),
    ]);
    if (legacyResult.status === 'rejected' && templateResult.status === 'rejected') {
      throw legacyResult.reason;
    }
    const legacyTemplates = legacyResult.status === 'fulfilled' ? legacyResult.value.data : [];
    const genericTemplates =
      templateResult.status === 'fulfilled' ? templateResult.value.map(templateToTaskTemplate) : [];
    return dedupeTaskTemplates([...legacyTemplates, ...genericTemplates]);
  } catch (err) {
    console.error('Failed to create service:', err);
    throw err;
  }
};

/**
 * The first authored task block of a YC-default Task Template (multi-task
 * builder), read from the `schedule.taskBlocks` snapshot field. Used to give the
 * single-task Add-task "Load from template" prefill something meaningful.
 */
type TaskBlockSeed = {
  name?: string;
  category?: string;
  additionalNotes?: string;
  description?: string;
  reminderOffsetMinutes?: number;
  recurrence?: { type?: string };
};

const firstTaskBlock = (template: TemplateLike): TaskBlockSeed | undefined => {
  const snapshot =
    (template as TemplateLike & { schemaSnapshot?: { sections?: unknown[] } }).schemaSnapshot ??
    template.versions?.find(
      (item) =>
        item.version === template.publishedVersion || item.version === template.latestVersion
    )?.schemaSnapshot;
  const sections = (snapshot as { sections?: Array<{ fields?: Array<Record<string, unknown>> }> })
    ?.sections;
  if (!Array.isArray(sections)) return undefined;
  for (const section of sections) {
    for (const field of section.fields ?? []) {
      if (field.key === 'taskBlocks' && Array.isArray(field.defaultValue)) {
        return (field.defaultValue as TaskBlockSeed[])[0];
      }
    }
  }
  return undefined;
};

const templateToTaskTemplate = (template: TemplateLike): TaskTemplate => {
  const block = firstTaskBlock(template);
  const category = block?.category || resolveTemplateTaskCategory(template);
  const instructions =
    block?.additionalNotes || block?.description || template.description || undefined;
  return {
    _id: template.id,
    source: 'ORG_TEMPLATE',
    organisationId: template.organisationId ?? '',
    category,
    name: block?.name || template.name,
    description: instructions,
    kind: resolveTemplateTaskKind(template),
    defaultRole: resolveTemplateDefaultRole(template),
    defaultReminderOffsetMinutes:
      block?.reminderOffsetMinutes ?? resolveTemplateReminderOffset(template),
    defaultRecurrence: block?.recurrence?.type
      ? { type: block.recurrence.type as NonNullable<TaskTemplate['defaultRecurrence']>['type'] }
      : undefined,
    isActive: template.status === 'PUBLISHED',
    createdBy: template.createdBy,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
};

const resolveTemplateTaskCategory = (template: TemplateLike) => {
  const rules = template.rules;
  if (rules && typeof rules === 'object' && !Array.isArray(rules)) {
    const category = (rules as { category?: unknown }).category;
    if (typeof category === 'string' && category.trim()) return category;
  }
  return 'CUSTOM';
};

const resolveTemplateTaskKind = (template: TemplateLike): TaskTemplate['kind'] => {
  const rules = template.rules;
  if (rules && typeof rules === 'object' && !Array.isArray(rules)) {
    const kind = (rules as { taskKind?: unknown; category?: unknown }).taskKind;
    if (typeof kind === 'string' && kind.trim()) return kind as TaskTemplate['kind'];
    const category = (rules as { category?: unknown }).category;
    if (typeof category === 'string' && category.trim()) return category as TaskTemplate['kind'];
  }
  return 'CUSTOM';
};

const resolveTemplateDefaultRole = (template: TemplateLike): TaskTemplate['defaultRole'] => {
  const rules = template.rules;
  if (rules && typeof rules === 'object' && !Array.isArray(rules)) {
    const audience = (rules as { audience?: unknown }).audience;
    if (audience === 'PARENT_TASK') return 'PARENT';
  }
  return 'EMPLOYEE';
};

const resolveTemplateReminderOffset = (template: TemplateLike) => {
  const rules = template.rules;
  if (rules && typeof rules === 'object' && !Array.isArray(rules)) {
    const value = (rules as { defaultReminderOffsetMinutes?: unknown })
      .defaultReminderOffsetMinutes;
    return typeof value === 'number' ? value : undefined;
  }
  return undefined;
};

const dedupeTaskTemplates = (templates: TaskTemplate[]) => {
  const byId = new Map<string, TaskTemplate>();
  for (const template of templates) {
    const id = template._id;
    if (id) byId.set(id, template);
  }
  return [...byId.values()];
};

export const getTaskLibrary = async (): Promise<TaskLibrary[]> => {
  try {
    const res = await getData<TaskLibrary[]>('/v1/task/pms/library');
    const data = res.data;
    return data;
  } catch (err) {
    console.error('Failed to create service:', err);
    throw err;
  }
};

export const getTaskLibraryById = async (libraryId: string): Promise<TaskLibrary | null> => {
  if (!libraryId) return null;
  const res = await getData<TaskLibrary>('/v1/task/pms/library/' + libraryId);
  return res.data;
};

export const createTaskLibrary = async (
  library: Omit<TaskLibrary, '_id'>
): Promise<TaskLibrary> => {
  const res = await postData<TaskLibrary>('/v1/task/pms/library', library);
  return res.data;
};

export const updateTaskLibrary = async (
  libraryId: string,
  patch: Partial<TaskLibrary>
): Promise<TaskLibrary | null> => {
  if (!libraryId) return null;
  const res = await putData<TaskLibrary>('/v1/task/pms/library/' + libraryId, patch);
  return res.data;
};
