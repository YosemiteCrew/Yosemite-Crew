// taskService.test.ts
import {
  loadTasksForPrimaryOrg,
  createTask,
  createTaskTemplate,
  updateTask,
  changeTaskStatus,
  getTaskTemplatesForPrimaryOrg,
  getTaskLibraryForPriaryOrg,
} from "../../services/taskService";

import { getData, postData, patchData } from "../../services/axios";
import { useOrgStore } from "../../stores/orgStore";
import { useTaskStore } from "../../stores/taskStore";
import { Task, TaskTemplate, TaskLibrary } from "../../types/task";

// --- Mocks ---

// 1. Mock Axios
jest.mock("../../services/axios");
const mockedGetData = getData as jest.Mock;
const mockedPostData = postData as jest.Mock;
const mockedPatchData = patchData as jest.Mock;

// 2. Mock Stores
jest.mock("../../stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(),
  },
}));

jest.mock("../../stores/taskStore", () => ({
  useTaskStore: {
    getState: jest.fn(),
  },
}));

describe("Task Service", () => {
  // Store spies
  const mockTaskStoreStartLoading = jest.fn();
  const mockTaskStoreSetTasksForOrg = jest.fn();
  const mockTaskStoreUpsertTask = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Store State Setup
    (useTaskStore.getState as jest.Mock).mockReturnValue({
      startLoading: mockTaskStoreStartLoading,
      setTasksForOrg: mockTaskStoreSetTasksForOrg,
      upsertTask: mockTaskStoreUpsertTask,
      status: "idle",
    });

    (useOrgStore.getState as jest.Mock).mockReturnValue({
      primaryOrgId: "org-123",
    });
  });

  // --- Helpers ---
  const makeBaseTask = (overrides: Partial<Task> = {}): Task => ({
    _id: "task-1",
    assignedTo: "user-1",
    audience: "EMPLOYEE_TASK",
    source: "CUSTOM",
    category: "General",
    name: "Test Task",
    dueAt: new Date(),
    status: "PENDING",
    ...overrides,
  });

  // --- Section 1: loadTasksForPrimaryOrg ---
  describe("loadTasksForPrimaryOrg", () => {
    it("warns and returns if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await loadTasksForPrimaryOrg();

      expect(consoleSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot load tasks."
      );
      expect(mockedGetData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("skips fetch if status is 'loaded' and not forced", async () => {
      (useTaskStore.getState as jest.Mock).mockReturnValue({
        status: "loaded",
        startLoading: mockTaskStoreStartLoading,
        setTasksForOrg: mockTaskStoreSetTasksForOrg,
      });

      await loadTasksForPrimaryOrg();

      expect(mockedGetData).not.toHaveBeenCalled();
    });

    it("fetches if forced even when loaded", async () => {
      (useTaskStore.getState as jest.Mock).mockReturnValue({
        status: "loaded",
        startLoading: mockTaskStoreStartLoading,
        setTasksForOrg: mockTaskStoreSetTasksForOrg,
      });

      mockedGetData.mockResolvedValue({ data: [] });

      await loadTasksForPrimaryOrg({ force: true });

      expect(mockedGetData).toHaveBeenCalledWith("/v1/task/pms/organisation/org-123");
    });

    it("does not trigger startLoading if silent option is true", async () => {
      mockedGetData.mockResolvedValue({ data: [] });

      await loadTasksForPrimaryOrg({ silent: true });

      expect(mockTaskStoreStartLoading).not.toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledWith("/v1/task/pms/organisation/org-123");
    });

    it("fetches successfully and updates store", async () => {
      const apiTasks: Task[] = [
        makeBaseTask({ _id: "task-1", name: "Task 1" }),
        makeBaseTask({ _id: "task-2", name: "Task 2" }),
      ];

      mockedGetData.mockResolvedValue({ data: apiTasks });

      await loadTasksForPrimaryOrg();

      expect(mockTaskStoreStartLoading).toHaveBeenCalled();
      expect(mockedGetData).toHaveBeenCalledWith("/v1/task/pms/organisation/org-123");
      expect(mockTaskStoreSetTasksForOrg).toHaveBeenCalledWith("org-123", apiTasks);
    });

    it("handles errors gracefully", async () => {
      const error = new Error("Network Error");
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(loadTasksForPrimaryOrg()).rejects.toThrow("Network Error");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to load tasks:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 2: createTask ---
  describe("createTask", () => {
    it("warns and returns if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await createTask(makeBaseTask());

      expect(consoleSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot create task."
      );
      expect(mockedPostData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("creates CUSTOM task using /custom route and upserts returned task", async () => {
      const task = makeBaseTask({ source: "CUSTOM" });
      const returned = { ...task, _id: "task-created", organisationId: "org-123" };

      mockedPostData.mockResolvedValue({ data: returned });

      await createTask(task);

      expect(mockedPostData).toHaveBeenCalledWith(
        "/v1/task/pms/custom",
        expect.objectContaining({
          _id: task._id,
          source: "CUSTOM",
          organisationId: "org-123",
        })
      );
      expect(mockTaskStoreUpsertTask).toHaveBeenCalledWith(returned);
    });

    it("creates ORG_TEMPLATE task using /from-template route and upserts returned task", async () => {
      const task = makeBaseTask({ source: "ORG_TEMPLATE", templateId: "tmpl-1" });
      const returned = { ...task, _id: "task-created", organisationId: "org-123" };

      mockedPostData.mockResolvedValue({ data: returned });

      await createTask(task);

      expect(mockedPostData).toHaveBeenCalledWith(
        "/v1/task/pms/from-template",
        expect.objectContaining({
          source: "ORG_TEMPLATE",
          organisationId: "org-123",
        })
      );
      expect(mockTaskStoreUpsertTask).toHaveBeenCalledWith(returned);
    });

    it("creates YC_LIBRARY task using /from-library route and upserts returned task", async () => {
      const task = makeBaseTask({ source: "YC_LIBRARY", libraryTaskId: "lib-1" });
      const returned = { ...task, _id: "task-created", organisationId: "org-123" };

      mockedPostData.mockResolvedValue({ data: returned });

      await createTask(task);

      expect(mockedPostData).toHaveBeenCalledWith(
        "/v1/task/pms/from-library",
        expect.objectContaining({
          source: "YC_LIBRARY",
          organisationId: "org-123",
        })
      );
      expect(mockTaskStoreUpsertTask).toHaveBeenCalledWith(returned);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("API Error");
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(createTask(makeBaseTask())).rejects.toThrow("API Error");

      expect(consoleSpy).toHaveBeenCalledWith("Failed to create task:", error);
      consoleSpy.mockRestore();
    });

    it("throws for invalid task source type", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(
        createTask(makeBaseTask({ source: "NOT_A_SOURCE" as any }))
      ).rejects.toThrow("Invalid task source type: NOT_A_SOURCE");

      expect(consoleSpy).toHaveBeenCalled(); // error logged in catch
      consoleSpy.mockRestore();
    });
  });

  // --- Section 3: createTaskTemplate ---
  describe("createTaskTemplate", () => {
    const makeTemplate = (overrides: Partial<TaskTemplate> = {}): TaskTemplate => ({
      id: "tmpl-1",
      source: "ORG_TEMPLATE",
      organisationId: "org-will-be-overwritten",
      category: "General",
      name: "Template Task",
      kind: "CUSTOM",
      defaultRole: "EMPLOYEE",
      isActive: true,
      createdBy: "user-1",
      ...overrides,
    });

    it("warns and returns if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await createTaskTemplate(makeTemplate());

      expect(consoleSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot create task."
      );
      expect(mockedPostData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("posts template with organisationId set to primaryOrgId", async () => {
      mockedPostData.mockResolvedValue({});

      const template = makeTemplate({ organisationId: "org-ignore" });
      await createTaskTemplate(template);

      expect(mockedPostData).toHaveBeenCalledWith(
        "/v1/task/pms/templates",
        expect.objectContaining({
          id: "tmpl-1",
          organisationId: "org-123",
        })
      );
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Template Error");
      mockedPostData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(createTaskTemplate(makeTemplate())).rejects.toThrow("Template Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create task:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 4: updateTask ---
  describe("updateTask", () => {
    it("warns and returns if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await updateTask(makeBaseTask());

      expect(consoleSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot update task."
      );
      expect(mockedPatchData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("warns and returns if payload is missing _id", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const payload = makeBaseTask({ _id: "" });

      await updateTask(payload);

      expect(consoleSpy).toHaveBeenCalledWith("updateTask: missing id:", payload);
      expect(mockedPatchData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("patches task and upserts returned task on success", async () => {
      const payload = makeBaseTask({ _id: "task-10", name: "Updated" });
      const returned = { ...payload, status: "IN_PROGRESS" as const };

      mockedPatchData.mockResolvedValue({ data: returned });

      await updateTask(payload);

      expect(mockedPatchData).toHaveBeenCalledWith("/v1/task/pms/task-10", payload);
      expect(mockTaskStoreUpsertTask).toHaveBeenCalledWith(returned);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Patch Error");
      mockedPatchData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(updateTask(makeBaseTask({ _id: "task-11" }))).rejects.toThrow("Patch Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to update task:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 5: changeTaskStatus ---
  describe("changeTaskStatus", () => {
    it("warns and returns if no primaryOrgId is selected", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      await changeTaskStatus(makeBaseTask({ status: "COMPLETED" }));

      expect(consoleSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot update task."
      );
      expect(mockedPatchData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("warns and returns if task is missing _id", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const task = makeBaseTask({ _id: "" });

      await changeTaskStatus(task);

      expect(consoleSpy).toHaveBeenCalledWith("updateTask: missing id:", task);
      expect(mockedPatchData).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("patches status endpoint and upserts returned task on success", async () => {
      const task = makeBaseTask({ _id: "task-20", status: "COMPLETED" });
      const returned = { ...task, completedAt: new Date() };

      mockedPatchData.mockResolvedValue({ data: returned });

      await changeTaskStatus(task);

      expect(mockedPatchData).toHaveBeenCalledWith(
        "/v1/task/pms/task-20/status",
        { status: "COMPLETED" }
      );
      expect(mockTaskStoreUpsertTask).toHaveBeenCalledWith(returned);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Status Error");
      mockedPatchData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(changeTaskStatus(makeBaseTask({ _id: "task-21" }))).rejects.toThrow(
        "Status Error"
      );
      expect(consoleSpy).toHaveBeenCalledWith("Failed to update task:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 6: getTaskTemplatesForPrimaryOrg ---
  describe("getTaskTemplatesForPrimaryOrg", () => {
    it("warns and returns [] if no primaryOrgId", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await getTaskTemplatesForPrimaryOrg();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot load companions."
      );
      consoleSpy.mockRestore();
    });

    it("fetches templates successfully", async () => {
      const templates: TaskTemplate[] = [
        {
          id: "tmpl-1",
          source: "ORG_TEMPLATE",
          organisationId: "org-123",
          category: "General",
          name: "T1",
          kind: "CUSTOM",
          defaultRole: "EMPLOYEE",
          isActive: true,
          createdBy: "user-1",
        },
      ];

      mockedGetData.mockResolvedValue({ data: templates });

      const result = await getTaskTemplatesForPrimaryOrg();

      expect(mockedGetData).toHaveBeenCalledWith(
        "/v1/task/pms/templates/organisation/org-123"
      );
      expect(result).toEqual(templates);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Templates Error");
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(getTaskTemplatesForPrimaryOrg()).rejects.toThrow("Templates Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create service:", error);
      consoleSpy.mockRestore();
    });
  });

  // --- Section 7: getTaskLibraryForPriaryOrg ---
  describe("getTaskLibraryForPriaryOrg", () => {
    it("warns and returns [] if no primaryOrgId", async () => {
      (useOrgStore.getState as jest.Mock).mockReturnValue({ primaryOrgId: null });
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      const result = await getTaskLibraryForPriaryOrg();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "No primary organization selected. Cannot load companions."
      );
      consoleSpy.mockRestore();
    });

    it("fetches library tasks successfully", async () => {
      const library: TaskLibrary[] = [
        {
          id: "lib-1",
          source: "YC_LIBRARY",
          kind: "CUSTOM",
          category: "General",
          name: "L1",
          schema: {},
          isActive: true,
        },
      ];

      mockedGetData.mockResolvedValue({ data: library });

      const result = await getTaskLibraryForPriaryOrg();

      expect(mockedGetData).toHaveBeenCalledWith("/v1/task/pms/organisation/org-123");
      expect(result).toEqual(library);
    });

    it("logs error and rethrows on failure", async () => {
      const error = new Error("Library Error");
      mockedGetData.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      await expect(getTaskLibraryForPriaryOrg()).rejects.toThrow("Library Error");
      expect(consoleSpy).toHaveBeenCalledWith("Failed to create service:", error);
      consoleSpy.mockRestore();
    });
  });
});
