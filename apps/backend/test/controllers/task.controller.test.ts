jest.mock("../../src/services/authUserMobile.service", () => ({
  __esModule: true,
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("../../src/services/task.service", () => {
  class MockTaskServiceError extends Error {
    constructor(
      message: string,
      public statusCode = 400,
    ) {
      super(message);
      this.name = "TaskServiceError";
    }
  }

  return {
    __esModule: true,
    TaskServiceError: MockTaskServiceError,
    TaskService: {
      createCustom: jest.fn(),
      createFromLibrary: jest.fn(),
      createFromTemplate: jest.fn(),
      getById: jest.fn(),
      updateTask: jest.fn(),
      changeStatus: jest.fn(),
      listForParent: jest.fn(),
      listForEmployee: jest.fn(),
      listForCompanion: jest.fn(),
    },
  };
});

jest.mock("../../src/services/taskLibrary.service", () => ({
  __esModule: true,
  TaskLibraryService: {
    listActive: jest.fn(),
    getById: jest.fn(),
  },
}));

jest.mock("../../src/services/taskTemplate.service", () => ({
  __esModule: true,
  TaskTemplateService: {
    create: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    listForOrganisation: jest.fn(),
    getById: jest.fn(),
  },
}));

import {
  TaskController,
  TaskLibraryController,
  TaskTemplateController,
} from "../../src/controllers/web/task.controller";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import { TaskService, TaskServiceError } from "../../src/services/task.service";
import { TaskLibraryService } from "../../src/services/taskLibrary.service";
import { TaskTemplateService } from "../../src/services/taskTemplate.service";

const mockedAuthUserService = AuthUserMobileService as unknown as jest.Mocked<
  typeof AuthUserMobileService
>;
const mockedTaskService = TaskService as unknown as jest.Mocked<
  typeof TaskService
>;
const mockedTaskLibraryService = TaskLibraryService as unknown as jest.Mocked<
  typeof TaskLibraryService
>;
const mockedTaskTemplateService = TaskTemplateService as unknown as jest.Mocked<
  typeof TaskTemplateService
>;

const createResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

describe("TaskController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createCustomTask", () => {
    it("returns 403 when parent id not found", async () => {
      mockedAuthUserService.getByProviderUserId.mockResolvedValueOnce(null);
      const req = {
        headers: { "x-user-id": "user-1" },
        body: {
          audience: "PARENT_TASK",
          companionId: "comp-1",
          dueAt: new Date(),
          assignedTo: "someone",
        },
      } as any;
      const res = createResponse();

      await TaskController.createCustomTask(req, res as any);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "Parent account not found",
      });
      expect(mockedTaskService.createCustom).not.toHaveBeenCalled();
    });

    it("creates custom task with resolved parent id", async () => {
      mockedAuthUserService.getByProviderUserId.mockResolvedValueOnce({
        parentId: { toString: () => "parent-1" },
      } as any);

      const req = {
        headers: { "x-user-id": "user-1" },
        body: {
          audience: "PARENT_TASK",
          companionId: "comp-1",
          dueAt: new Date("2024-01-01T00:00:00Z"),
        },
      } as any;
      const res = createResponse();
      const task = { _id: "task-1" };
      mockedTaskService.createCustom.mockResolvedValueOnce(task as any);

      await TaskController.createCustomTask(req, res as any);

      expect(mockedTaskService.createCustom).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: "parent-1",
          assignedBy: "parent-1",
          assignedTo: "parent-1",
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(task);
    });
  });

  describe("createFromLibrary", () => {
    it("uses header user id and passes through to service", async () => {
      const req = {
        headers: { "x-user-id": "actor-1" },
        body: {
          audience: "EMPLOYEE_TASK",
          companionId: "comp-1",
          libraryTaskId: "lib-1",
          dueAt: new Date(),
          assignedTo: "user-2",
        },
      } as any;
      const res = createResponse();
      const task = { _id: "t1" };
      mockedTaskService.createFromLibrary.mockResolvedValueOnce(task as any);

      await TaskController.createFromLibrary(req, res as any);

      expect(mockedTaskService.createFromLibrary).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: "actor-1",
          assignedBy: "actor-1",
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(task);
    });
  });

  describe("createFromTemplate", () => {
    it("calls service with actor id", async () => {
      const req = {
        headers: { "x-user-id": "actor-2" },
        body: {
          templateId: "tmpl-1",
          companionId: "comp-2",
          dueAt: new Date(),
          assignedTo: "user-5",
        },
      } as any;
      const res = createResponse();
      mockedTaskService.createFromTemplate.mockResolvedValueOnce({
        _id: "t2",
      } as any);

      await TaskController.createFromTemplate(req, res as any);

      expect(mockedTaskService.createFromTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: "actor-2",
          assignedBy: "actor-2",
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("getById", () => {
    it("returns 404 when missing", async () => {
      mockedTaskService.getById.mockResolvedValueOnce(null);
      const req = { params: { taskId: "missing" } } as any;
      const res = createResponse();

      await TaskController.getById(req, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "Task not found" });
    });
  });

  describe("updateTask", () => {
    it("delegates to service with actor id", async () => {
      mockedTaskService.updateTask.mockResolvedValueOnce({
        _id: "task-1",
      } as any);
      const req = {
        headers: { "x-user-id": "actor-3" },
        params: { taskId: "task-1" },
        body: { name: "Updated" },
      } as any;
      const res = createResponse();

      await TaskController.updateTask(req, res as any);

      expect(mockedTaskService.updateTask).toHaveBeenCalledWith(
        "task-1",
        { name: "Updated" },
        "actor-3",
      );
      expect(res.json).toHaveBeenCalledWith({ _id: "task-1" });
    });
  });

  describe("changeStatus", () => {
    it("rejects invalid status", async () => {
      const req = {
        headers: { "x-user-id": "actor" },
        params: { taskId: "task-1" },
        body: { status: "UNKNOWN" },
      } as any;
      const res = createResponse();

      await TaskController.changeStatus(req, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid task status" });
      expect(mockedTaskService.changeStatus).not.toHaveBeenCalled();
    });

    it("passes through valid status", async () => {
      mockedTaskService.changeStatus.mockResolvedValueOnce({
        task: { _id: "task-1" },
      } as any);
      const req = {
        headers: { "x-user-id": "actor" },
        params: { taskId: "task-1" },
        body: { status: "COMPLETED" },
      } as any;
      const res = createResponse();

      await TaskController.changeStatus(req, res as any);

      expect(mockedTaskService.changeStatus).toHaveBeenCalledWith(
        "task-1",
        "COMPLETED",
        "actor",
        undefined,
      );
      expect(res.json).toHaveBeenCalledWith({ task: { _id: "task-1" } });
    });
  });

  describe("listParentTasks", () => {
    it("returns 403 when auth user missing", async () => {
      mockedAuthUserService.getByProviderUserId.mockResolvedValueOnce(null);
      const req = { headers: { "x-user-id": "u" }, query: {} } as any;
      const res = createResponse();

      await TaskController.listParentTasks(req, res as any);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Parent not found" });
    });

    it("parses filters and delegates", async () => {
      mockedAuthUserService.getByProviderUserId.mockResolvedValueOnce({
        parentId: "parent-9",
      } as any);
      const req = {
        headers: { "x-user-id": "u" },
        query: {
          companionId: "comp-1",
          fromDueAt: "2024-01-01T00:00:00Z",
          toDueAt: "2024-01-02T00:00:00Z",
          status: "PENDING,COMPLETED",
        },
      } as any;
      const res = createResponse();
      mockedTaskService.listForParent.mockResolvedValueOnce([
        { _id: "t" },
      ] as any);

      await TaskController.listParentTasks(req, res as any);

      expect(mockedTaskService.listForParent).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: "parent-9",
          companionId: "comp-1",
          fromDueAt: new Date("2024-01-01T00:00:00Z"),
          toDueAt: new Date("2024-01-02T00:00:00Z"),
          status: ["PENDING", "COMPLETED"],
        }),
      );
      expect(res.json).toHaveBeenCalledWith([{ _id: "t" }]);
    });
  });

  describe("listEmployeeTasks", () => {
    it("parses filters", async () => {
      const req = {
        params: { organisationId: "org-1" },
        query: {
          userId: "user-9",
          companionId: "comp-2",
          status: "IN_PROGRESS",
        },
      } as any;
      const res = createResponse();
      mockedTaskService.listForEmployee.mockResolvedValueOnce([
        { _id: "t2" },
      ] as any);

      await TaskController.listEmployeeTasks(req, res as any);

      expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org-1",
          userId: "user-9",
          companionId: "comp-2",
          status: ["IN_PROGRESS"],
        }),
      );
      expect(res.json).toHaveBeenCalledWith([{ _id: "t2" }]);
    });
  });

  describe("listForCompanion", () => {
    it("parses filters and returns tasks", async () => {
      const req = {
        params: { companionId: "comp-3" },
        query: { audience: "PARENT_TASK", status: "PENDING" },
      } as any;
      const res = createResponse();
      mockedTaskService.listForCompanion.mockResolvedValueOnce([
        { _id: "t3" },
      ] as any);

      await TaskController.listForCompanion(req, res as any);

      expect(mockedTaskService.listForCompanion).toHaveBeenCalledWith(
        expect.objectContaining({
          companionId: "comp-3",
          audience: "PARENT_TASK",
          status: ["PENDING"],
        }),
      );
      expect(res.json).toHaveBeenCalledWith([{ _id: "t3" }]);
    });
  });
});

describe("TaskLibraryController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists active tasks with kind filter", async () => {
    const req = { query: { kind: "MEDICATION" } } as any;
    const res = createResponse();
    mockedTaskLibraryService.listActive.mockResolvedValueOnce([
      { _id: "lib" },
    ] as any);

    await TaskLibraryController.list(req, res as any);

    expect(mockedTaskLibraryService.listActive).toHaveBeenCalledWith(
      "MEDICATION",
    );
    expect(res.json).toHaveBeenCalledWith([{ _id: "lib" }]);
  });

  it("gets by id", async () => {
    const req = { params: { libraryId: "lib-1" } } as any;
    const res = createResponse();
    mockedTaskLibraryService.getById.mockResolvedValueOnce({
      _id: "lib-1",
    } as any);

    await TaskLibraryController.getById(req, res as any);

    expect(mockedTaskLibraryService.getById).toHaveBeenCalledWith("lib-1");
    expect(res.json).toHaveBeenCalledWith({ _id: "lib-1" });
  });
});

describe("TaskTemplateController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates template with actor id", async () => {
    const req = {
      headers: { "x-user-id": "creator-1" },
      body: {
        organisationId: "org-1",
        name: "Template",
        category: "A",
        kind: "CUSTOM",
        defaultRole: "EMPLOYEE",
      },
    } as any;
    const res = createResponse();
    mockedTaskTemplateService.create.mockResolvedValueOnce({
      _id: "tmpl",
    } as any);

    await TaskTemplateController.create(req, res as any);

    expect(mockedTaskTemplateService.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "creator-1" }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ _id: "tmpl" });
  });

  it("updates template", async () => {
    const req = {
      params: { templateId: "tmpl-1" },
      body: { name: "New name" },
    } as any;
    const res = createResponse();
    mockedTaskTemplateService.update.mockResolvedValueOnce({
      _id: "tmpl-1",
    } as any);

    await TaskTemplateController.update(req, res as any);

    expect(mockedTaskTemplateService.update).toHaveBeenCalledWith("tmpl-1", {
      name: "New name",
    });
    expect(res.json).toHaveBeenCalledWith({ _id: "tmpl-1" });
  });

  it("archives template", async () => {
    const req = { params: { templateId: "tmpl-2" } } as any;
    const res = createResponse();

    await TaskTemplateController.archive(req, res as any);

    expect(mockedTaskTemplateService.archive).toHaveBeenCalledWith("tmpl-2");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("lists templates by organisation", async () => {
    const req = {
      params: { organisationId: "org-2" },
      query: { kind: "HYGIENE" },
    } as any;
    const res = createResponse();
    mockedTaskTemplateService.listForOrganisation.mockResolvedValueOnce([
      { _id: "tmpl-3" },
    ] as any);

    await TaskTemplateController.list(req, res as any);

    expect(mockedTaskTemplateService.listForOrganisation).toHaveBeenCalledWith(
      "org-2",
      "HYGIENE",
    );
    expect(res.json).toHaveBeenCalledWith([{ _id: "tmpl-3" }]);
  });

  it("gets template by id", async () => {
    const req = { params: { templateId: "tmpl-4" } } as any;
    const res = createResponse();
    mockedTaskTemplateService.getById.mockResolvedValueOnce({
      _id: "tmpl-4",
    } as any);

    await TaskTemplateController.getById(req, res as any);

    expect(mockedTaskTemplateService.getById).toHaveBeenCalledWith("tmpl-4");
    expect(res.json).toHaveBeenCalledWith({ _id: "tmpl-4" });
  });
});
