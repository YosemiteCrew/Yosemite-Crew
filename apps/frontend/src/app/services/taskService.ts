import { useOrgStore } from "../stores/orgStore";
import { useTaskStore } from "../stores/taskStore";
import { Task, TaskLibrary, TaskTemplate } from "../types/task";
import { getData, patchData, postData } from "./axios";

export const loadTasksForPrimaryOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
}): Promise<void> => {
  const { startLoading, status, setTasksForOrg } = useTaskStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load tasks.");
    return;
  }
  if (!shouldFetchTasks(status, opts)) return;
  if (!opts?.silent) startLoading();
  try {
    const res = await getData<Task[]>(
      "/v1/task/pms/organisation/" + primaryOrgId
    );
    const tasks = res.data ?? [];
    setTasksForOrg(primaryOrgId, tasks);
  } catch (err) {
    console.error("Failed to load tasks:", err);
    throw err;
  }
};

const shouldFetchTasks = (
  status: ReturnType<typeof useTaskStore.getState>["status"],
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  return status === "idle" || status === "error";
};

export const createTask = async (task: Task) => {
  const { upsertTask } = useTaskStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot create task.");
    return;
  }
  try {
    const payload: Task = {
      ...task,
      organisationId: primaryOrgId,
    };
    const type = task.source
    const isCustomTask = type === "CUSTOM"
    const isTemplateTask = type === "ORG_TEMPLATE"
    const isLibraryTask = type === "YC_LIBRARY"
    let route = "/v1/task/pms/"
    if (isCustomTask) {
      route = route + "custom";
    } else if (isTemplateTask) {
      route = route + "from-template";
    } else if (isLibraryTask) {
      route = route + "from-library";
    } else {
      throw new Error("Invalid task source type: " + type);
    }
    const res = await postData<Task>(route, payload);
    const normalTask = res.data;
    upsertTask(normalTask);
  } catch (err) {
    console.error("Failed to create task:", err);
    throw err;
  }
};

export const createTaskTemplate = async (task: TaskTemplate) => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot create task.");
    return;
  }
  try {
    const payload: TaskTemplate = {
      ...task,
      organisationId: primaryOrgId,
    };
    await postData("/v1/task/pms/templates", payload);
  } catch (err) {
    console.error("Failed to create task:", err);
    throw err;
  }
};

export const updateTask = async (payload: Task) => {
  const { upsertTask } = useTaskStore.getState();
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot update task.");
    return;
  }
  if (!payload?._id) {
    console.warn("updateTask: missing id:", payload);
    return;
  }
  try {
    const res = await patchData<Task>("/v1/task/pms/" + payload._id, payload);
    const normalTask = res.data;
    upsertTask(normalTask);
  } catch (err) {
    console.error("Failed to update task:", err);
    throw err;
  }
};

export const changeTaskStatus = async (task: Task) => {
  const { upsertTask } = useTaskStore.getState();

  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot update task.");
    return;
  }
  if (!task?._id) {
    console.warn("updateTask: missing id:", task);
    return;
  }
  try {
    const payload = {
      status: task.status,
    };
    const res = await patchData<Task>(
      "/v1/task/pms/" + task._id + "/status",
      payload
    );
    const normalTask = res.data;
    upsertTask(normalTask);
  } catch (err) {
    console.error("Failed to update task:", err);
    throw err;
  }
};

export const getTaskTemplatesForPrimaryOrg = async (): Promise<
  TaskTemplate[]
> => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return [];
  }
  try {
    const res = await getData<TaskTemplate[]>(
      "/v1/task/pms/templates/organisation/" + primaryOrgId
    );
    const data = res.data;
    return data;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const getTaskLibraryForPriaryOrg = async (): Promise<TaskLibrary[]> => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return [];
  }
  try {
    const res = await getData<TaskLibrary[]>(
      "/v1/task/pms/organisation/" + primaryOrgId
    );
    const data = res.data;
    return data;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};
