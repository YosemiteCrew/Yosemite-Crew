import { useOrgStore } from '@/app/stores/orgStore';
import { useTaskStore } from '@/app/stores/taskStore';
import { Task, TaskKind, TaskLibrary, TaskTemplate } from '@/app/features/tasks/types/task';
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

export const updateTask = async (payload: Task) => {
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
    const res = await patchData<Task>('/v1/task/pms/' + payload._id, payload);
    const normalTask = res.data;
    upsertTask(normalTask);
  } catch (err) {
    console.error('Failed to update task:', err);
    throw err;
  }
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

const templateToTaskTemplate = (template: TemplateLike): TaskTemplate => ({
  _id: template.id,
  source: 'ORG_TEMPLATE',
  organisationId: template.organisationId ?? '',
  category: resolveTemplateTaskCategory(template),
  name: template.name,
  description: template.description ?? undefined,
  kind: resolveTemplateTaskKind(template),
  defaultRole: resolveTemplateDefaultRole(template),
  defaultReminderOffsetMinutes: resolveTemplateReminderOffset(template),
  isActive: template.status === 'PUBLISHED',
  createdBy: template.createdBy,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
});

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
