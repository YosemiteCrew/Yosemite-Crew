import { useTaskStore } from "../../stores/taskStore";
import { Task } from "../../types/task";

// --- Mock Data ---
// Cast to unknown first to avoid strict type adherence for fields not relevant to store logic

const baseTask = {
  audience: "EMPLOYEE_TASK",
  source: "CUSTOM",
  category: "Admin",
  name: "Task",
  assignedTo: "team-1",
  dueAt: new Date("2025-01-02T00:00:00.000Z"),
  status: "PENDING",
} as const;

const mockTask1: Task = {
  _id: "task-1",
  organisationId: "org-A",
  ...baseTask,
  name: "Onboard",
} as unknown as Task;

const mockTask2: Task = {
  _id: "task-2",
  organisationId: "org-A",
  ...baseTask,
  name: "Follow up",
} as unknown as Task;

const mockTask3: Task = {
  _id: "task-3",
  organisationId: "org-B",
  ...baseTask,
  name: "X-Ray prep",
} as unknown as Task;

const mockTaskNoId: Task = {
  // _id missing
  organisationId: "org-A",
  ...baseTask,
  name: "Invalid Task",
} as unknown as Task;

const mockTaskNoOrg: Task = {
  _id: "task-bad",
  // organisationId missing
  ...baseTask,
  name: "Orphan Task",
} as unknown as Task;

describe("Task Store", () => {
  beforeEach(() => {
    // Reset store before each test
    useTaskStore.setState({
      tasksById: {},
      taskIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    });
    jest.clearAllMocks();
  });

  // --- Section 1: Initialization & Status Management ---
  describe("Initialization & Status", () => {
    it("initializes with default empty state", () => {
      const state = useTaskStore.getState();
      expect(state.tasksById).toEqual({});
      expect(state.taskIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
      expect(state.lastFetchedAt).toBeNull();
    });

    it("manages loading state", () => {
      const store = useTaskStore.getState();

      store.startLoading();
      expect(useTaskStore.getState().status).toBe("loading");
      expect(useTaskStore.getState().error).toBeNull();

      store.endLoading();
      expect(useTaskStore.getState().status).toBe("loaded");
      expect(useTaskStore.getState().error).toBeNull();
    });

    it("sets error state", () => {
      const store = useTaskStore.getState();

      store.setError("Failed to fetch tasks");
      expect(useTaskStore.getState().status).toBe("error");
      expect(useTaskStore.getState().error).toBe("Failed to fetch tasks");
    });

    it("clears the store completely", () => {
      const store = useTaskStore.getState();
      store.setTasks([mockTask1]);

      store.clearTasks();

      const state = useTaskStore.getState();
      expect(state.tasksById).toEqual({});
      expect(state.taskIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
      expect(state.lastFetchedAt).toBeNull();
    });
  });

  // --- Section 2: Bulk Set & Getters ---
  describe("Bulk Operations", () => {
    it("sets all tasks globally and indexes them correctly (by organisationId)", () => {
      const store = useTaskStore.getState();
      store.setTasks([mockTask1, mockTask2, mockTask3]);

      const state = useTaskStore.getState();
      expect(state.status).toBe("loaded");

      expect(state.tasksById["task-1"]).toEqual(
        expect.objectContaining({ _id: "task-1", organisationId: "org-A" })
      );
      expect(state.tasksById["task-3"]).toEqual(
        expect.objectContaining({ _id: "task-3", organisationId: "org-B" })
      );

      // Verify indexing
      expect(state.taskIdsByOrgId["org-A"]).toHaveLength(2);
      expect(state.taskIdsByOrgId["org-A"]).toContain("task-1");
      expect(state.taskIdsByOrgId["org-A"]).toContain("task-2");
      expect(state.taskIdsByOrgId["org-B"]).toEqual(["task-3"]);
      expect(state.lastFetchedAt).toEqual(expect.any(String));
    });

    it("skips tasks with missing _id during setTasks", () => {
      useTaskStore.getState().setTasks([mockTask1, mockTaskNoId, mockTask3]);

      const state = useTaskStore.getState();
      expect(state.tasksById["task-1"]).toBeDefined();
      expect(state.tasksById["task-3"]).toBeDefined();
      expect(Object.keys(state.tasksById)).toHaveLength(2);

      // should not have indexed the invalid task
      expect(state.taskIdsByOrgId["org-A"]).toEqual(["task-1"]);
    });

    it("does not index tasks without organisationId during setTasks", () => {
      const taskNoOrgButHasId: Task = {
        _id: "task-no-org",
        ...baseTask,
        name: "No Org Task",
      } as unknown as Task;

      useTaskStore.getState().setTasks([taskNoOrgButHasId]);

      const state = useTaskStore.getState();
      expect(state.tasksById["task-no-org"]).toBeDefined();
      expect(state.taskIdsByOrgId).toEqual({});
    });

    it("sets tasks for a specific org (replaces org slice)", () => {
      // Setup initial state with Org A and Org B
      useTaskStore.getState().setTasks([mockTask1, mockTask3]);

      // Replace ONLY Org A tasks: remove task-1, add task-2
      useTaskStore.getState().setTasksForOrg("org-A", [mockTask2]);

      const state = useTaskStore.getState();

      // Org A now only task-2
      expect(state.taskIdsByOrgId["org-A"]).toEqual(["task-2"]);
      expect(state.tasksById["task-1"]).toBeUndefined();
      expect(state.tasksById["task-2"]).toBeDefined();

      // Org B untouched
      expect(state.taskIdsByOrgId["org-B"]).toEqual(["task-3"]);
      expect(state.tasksById["task-3"]).toBeDefined();
    });

    it("skips items with missing _id in setTasksForOrg", () => {
      useTaskStore.getState().setTasks([mockTask1]);

      useTaskStore
        .getState()
        .setTasksForOrg("org-A", [mockTaskNoId, mockTask2]);

      const state = useTaskStore.getState();
      expect(state.taskIdsByOrgId["org-A"]).toEqual(["task-2"]);
      expect(state.tasksById["task-2"]).toBeDefined();
      expect(state.tasksById["task-1"]).toBeUndefined(); // replaced slice
    });

    it("retrieves tasks by orgId", () => {
      useTaskStore.getState().setTasks([mockTask1, mockTask2, mockTask3]);

      const orgATasks = useTaskStore.getState().getTasksByOrgId("org-A");
      expect(orgATasks).toHaveLength(2);
      expect(orgATasks.find((t) => t._id === "task-1")).toBeDefined();

      // Non-existent org
      expect(useTaskStore.getState().getTasksByOrgId("org-C")).toEqual([]);
    });
  });

  // --- Section 3: Upsert Operations ---
  describe("Upsert Operations", () => {
    it("adds a new task if it does not exist", () => {
      useTaskStore.getState().setTasks([mockTask1]);

      // Upsert new task-2
      useTaskStore.getState().upsertTask(mockTask2);

      const state = useTaskStore.getState();
      expect(state.tasksById["task-2"]).toBeDefined();
      expect(state.taskIdsByOrgId["org-A"]).toContain("task-2");
      expect(state.taskIdsByOrgId["org-A"]).toHaveLength(2);
      expect(state.status).toBe("loaded");
      expect(state.lastFetchedAt).toEqual(expect.any(String));
    });

    it("updates an existing task and does not duplicate the ID in org index", () => {
      useTaskStore.getState().setTasks([mockTask1]);

      const updatedTask1 = {
        ...mockTask1,
        name: "Onboard Updated",
      } as unknown as Task;

      useTaskStore.getState().upsertTask(updatedTask1);

      const state = useTaskStore.getState();
      expect(state.tasksById["task-1"].name).toBe("Onboard Updated");
      expect(state.taskIdsByOrgId["org-A"]).toHaveLength(1);
    });

    it("handles upsert gracefully when _id is missing", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      useTaskStore.getState().upsertTask(mockTaskNoId);

      const state = useTaskStore.getState();
      expect(Object.keys(state.tasksById)).toHaveLength(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "upsertTask: missing id:",
        mockTaskNoId
      );

      consoleSpy.mockRestore();
    });

    it("handles upsert gracefully when organisationId is missing", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      useTaskStore.getState().upsertTask(mockTaskNoOrg);

      const state = useTaskStore.getState();
      expect(state.tasksById["task-bad"]).toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        "upsertTask: missing organisationId:",
        mockTaskNoOrg
      );

      consoleSpy.mockRestore();
    });

    it("handles upsert for a new organization not yet in store", () => {
      useTaskStore.getState().upsertTask(mockTask3);

      const state = useTaskStore.getState();
      expect(state.taskIdsByOrgId["org-B"]).toEqual(["task-3"]);
      expect(state.tasksById["task-3"]).toBeDefined();
    });
  });

  // --- Section 4: Removal & Cleanup ---
  describe("Removal & Cleanup", () => {
    it("removes a task by id", () => {
      useTaskStore.getState().setTasks([mockTask1, mockTask2]);

      useTaskStore.getState().removeTask("task-1");

      const state = useTaskStore.getState();
      expect(state.tasksById["task-1"]).toBeUndefined();
      expect(state.tasksById["task-2"]).toBeDefined();
      expect(state.taskIdsByOrgId["org-A"]).toEqual(["task-2"]);
    });

    it("does nothing when removing a non-existent id", () => {
      useTaskStore.getState().setTasks([mockTask1]);
      const initialSnapshot = JSON.stringify(useTaskStore.getState());

      useTaskStore.getState().removeTask("fake-id");

      const finalSnapshot = JSON.stringify(useTaskStore.getState());
      expect(finalSnapshot).toEqual(initialSnapshot);
    });

    it("clears all tasks for a specific organization", () => {
      useTaskStore.getState().setTasks([mockTask1, mockTask3]);

      useTaskStore.getState().clearTasksForOrg("org-A");

      const state = useTaskStore.getState();
      expect(state.taskIdsByOrgId["org-A"]).toBeUndefined();
      expect(state.tasksById["task-1"]).toBeUndefined();

      // Org B remains
      expect(state.taskIdsByOrgId["org-B"]).toBeDefined();
      expect(state.tasksById["task-3"]).toBeDefined();
    });

    it("handles clearing an organization that has no data safely", () => {
      useTaskStore.getState().setTasks([mockTask1]);

      useTaskStore.getState().clearTasksForOrg("org-Empty");

      const state = useTaskStore.getState();
      expect(state.taskIdsByOrgId["org-Empty"]).toBeUndefined();
      expect(state.tasksById["task-1"]).toBeDefined();
    });
  });
});
