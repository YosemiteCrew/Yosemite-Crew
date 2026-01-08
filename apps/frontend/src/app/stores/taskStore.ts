import { create } from "zustand";
import { Task } from "../types/task";

type TaskStoreStatus = "idle" | "loading" | "loaded" | "error";

type TaskState = {
  tasksById: Record<string, Task>;
  taskIdsByOrgId: Record<string, string[]>;

  status: TaskStoreStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setTasks: (tasks: Task[]) => void;
  setTasksForOrg: (orgId: string, items: Task[]) => void;
  upsertTask: (task: Task) => void;

  getTasksByOrgId: (orgId: string) => Task[];

  removeTask: (id: string) => void;
  clearTasksForOrg: (orgId: string) => void;
  clearTasks: () => void;

  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

const uniqAppend = (arr: string[], id: string) =>
  arr.includes(id) ? arr : [...arr, id];

export const useTaskStore = create<TaskState>()((set, get) => ({
  tasksById: {},
  taskIdsByOrgId: {},

  status: "idle",
  error: null,
  lastFetchedAt: null,

  setTasks: (tasks) =>
    set(() => {
      const tasksById: Record<string, Task> = {};
      const taskIdsByOrgId: Record<string, string[]> = {};
      for (const t of tasks) {
        const id = t._id;
        if (!id) continue;
        tasksById[id] = { ...t, _id: id };
        if (t.organisationId) {
          const orgId = t.organisationId;
          if (!taskIdsByOrgId[orgId]) taskIdsByOrgId[orgId] = [];
          taskIdsByOrgId[orgId].push(id);
        }
      }
      return {
        tasksById,
        taskIdsByOrgId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  setTasksForOrg: (orgId, items) =>
    set((state) => {
      const tasksById = { ...state.tasksById };
      const existingIds = state.taskIdsByOrgId[orgId] ?? [];
      for (const id of existingIds) delete tasksById[id];
      const newIds: string[] = [];
      for (const task of items) {
        const id = task._id;
        if (!id) continue;
        tasksById[id] = task;
        newIds.push(id);
      }
      return {
        tasksById,
        taskIdsByOrgId: {
          ...state.taskIdsByOrgId,
          [orgId]: newIds,
        },
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  upsertTask: (task) =>
    set((state) => {
      const id = task._id;
      const orgId = task.organisationId;
      if (!id) {
        console.warn("upsertTask: missing id:", task);
        return state;
      }
      if (!orgId) {
        console.warn("upsertTask: missing organisationId:", task);
        return state;
      }
      const tasksById = {
        ...state.tasksById,
        [id]: {
          ...(state.tasksById[id] ?? ({} as Task)),
          ...task,
          id,
        },
      };
      const existingIds = state.taskIdsByOrgId[orgId] ?? [];
      const taskIdsByOrgId = {
        ...state.taskIdsByOrgId,
        [orgId]: uniqAppend(existingIds, id),
      };
      return {
        tasksById,
        taskIdsByOrgId,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  getTasksByOrgId: (orgId) => {
    const { tasksById, taskIdsByOrgId } = get();
    const ids = taskIdsByOrgId[orgId] ?? [];
    return ids.map((id) => tasksById[id]).filter((t): t is Task => t != null);
  },

  removeTask: (id) =>
    set((state) => {
      const { [id]: _, ...restTasksById } = state.tasksById;
      const taskIdsByOrgId: Record<string, string[]> = {};
      for (const [orgId, ids] of Object.entries(state.taskIdsByOrgId)) {
        taskIdsByOrgId[orgId] = ids.filter((taskId) => taskId !== id);
      }
      return {
        tasksById: restTasksById,
        taskIdsByOrgId,
      };
    }),

  clearTasksForOrg: (orgId) =>
    set((state) => {
      const ids = state.taskIdsByOrgId[orgId] ?? [];
      const tasksById = { ...state.tasksById };
      for (const id of ids) delete tasksById[id];
      const { [orgId]: _, ...restIdx } = state.taskIdsByOrgId;
      return {
        tasksById,
        taskIdsByOrgId: restIdx,
        status: "loaded",
        error: null,
        lastFetchedAt: new Date().toISOString(),
      };
    }),

  clearTasks: () =>
    set(() => ({
      tasksById: {},
      taskIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    })),

  startLoading: () => set(() => ({ status: "loading", error: null })),
  endLoading: () => set(() => ({ status: "loaded", error: null })),
  setError: (message) => set(() => ({ status: "error", error: message })),
}));
