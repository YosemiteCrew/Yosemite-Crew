import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { TaskController } from "../../../src/controllers/web/task.controller";
import {
  TaskService,
  TaskServiceError,
  type CompleteTaskInput,
} from "../../../src/services/task.service";

jest.mock("../../../src/services/task.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/task.service",
  ) as typeof import("../../../src/services/task.service");
  return {
    ...actual,
    TaskService: {
      ...actual.TaskService,
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
      changeStatus: jest.fn(),
      getById: jest.fn(),
      listForEmployee: jest.fn(),
    },
  };
});

const mockedTaskService = jest.mocked(TaskService);

describe("TaskController", () => {
  type TestRequest = Partial<Request> & {
    userId?: string;
    userPermissions?: string[];
    organisationId?: string;
  };
  let req: TestRequest;
  let res: Response;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  // The controller forwards req.body.completion verbatim, so this deliberately
  // arbitrary body is what the service is expected to receive.
  const completionBody = { notes: "done" } as unknown as CompleteTaskInput;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      params: { taskId: "task-1" },
      body: { status: "COMPLETED", completion: completionBody },
      headers: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  describe("changeStatusPMS", () => {
    it("uses authenticated userId (not x-user-id) as actorId", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      req.headers = { "x-user-id": "spoofed-user-id" } as any;
      mockedTaskService.changeStatus.mockResolvedValue({ ok: true } as any);

      await TaskController.changeStatusPMS(req as Request, res);

      expect(mockedTaskService.changeStatus).toHaveBeenCalledWith(
        "task-1",
        "COMPLETED",
        "auth-user-id",
        completionBody,
        "org-1",
      );
      expect(statusMock).not.toHaveBeenCalledWith(403);
    });

    it("rejects when no authenticated userId is present even if x-user-id is set", async () => {
      req.userId = undefined;
      req.headers = { "x-user-id": "spoofed-user-id" } as any;

      await TaskController.changeStatusPMS(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Account not found" });
      expect(mockedTaskService.changeStatus).not.toHaveBeenCalled();
    });

    it("binds the change to the authorized organisationId", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      mockedTaskService.changeStatus.mockResolvedValue({ ok: true } as any);

      await TaskController.changeStatusPMS(req as Request, res);

      expect(mockedTaskService.changeStatus).toHaveBeenCalledWith(
        "task-1",
        "COMPLETED",
        "auth-user-id",
        completionBody,
        "org-1",
      );
    });
  });

  describe("updateTaskPMS", () => {
    it("passes the authenticated actor and authorized organisationId to the service", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      req.headers = { "x-user-id": "spoofed-user-id" } as any;
      req.body = { name: "new" } as any;
      mockedTaskService.updateTask.mockResolvedValue({ id: "task-1" } as any);

      await TaskController.updateTaskPMS(req as Request, res);

      expect(mockedTaskService.updateTask).toHaveBeenCalledWith(
        "task-1",
        { name: "new" },
        "auth-user-id",
        "THIS",
        "org-1",
      );
    });
  });

  describe("getById (PMS own-scope)", () => {
    beforeEach(() => {
      req.body = {};
    });

    it("scopes the lookup to the authorized organisationId", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      req.userPermissions = ["tasks:view:any"];
      mockedTaskService.getById.mockResolvedValue({
        id: "task-1",
        createdBy: "someone-else",
        assignedTo: "another",
      } as any);

      await TaskController.getById(req as Request, res);

      expect(mockedTaskService.getById).toHaveBeenCalledWith("task-1", "org-1");
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "task-1" }),
      );
    });

    it("hides another user's task from a tasks:view:own-only caller", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      req.userPermissions = ["tasks:view:own"];
      mockedTaskService.getById.mockResolvedValue({
        id: "task-1",
        createdBy: "someone-else",
        assignedTo: "another-user",
      } as any);

      await TaskController.getById(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Task not found" });
    });

    it("allows a tasks:view:own caller to read their own task", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      req.userPermissions = ["tasks:view:own"];
      mockedTaskService.getById.mockResolvedValue({
        id: "task-1",
        createdBy: "another-user",
        assignedTo: "auth-user-id",
      } as any);

      await TaskController.getById(req as Request, res);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "task-1" }),
      );
      expect(statusMock).not.toHaveBeenCalledWith(404);
    });
  });

  describe("listEmployeeTasks (own-scope)", () => {
    beforeEach(() => {
      req.body = {};
      req.query = {};
      mockedTaskService.listForEmployee.mockResolvedValue([] as any);
    });

    it("ignores a spoofed assignedTo for a tasks:view:own-only caller", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      req.userPermissions = ["tasks:view:own"];
      req.query = { assignedTo: "victim-user-id" } as any;

      await TaskController.listEmployeeTasks(req as Request, res);

      // Own-scope passes an ownerId (created OR assigned), never the
      // client-supplied assignedTo, so the spoofed victim id is ignored.
      expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org-1",
          ownerId: "auth-user-id",
        }),
      );
      const callArg = mockedTaskService.listForEmployee.mock.calls[0][0] as {
        assignedTo?: string;
      };
      expect(callArg.assignedTo).not.toBe("victim-user-id");
    });

    it("forces own-scope (created or assigned) when no assignedTo is supplied", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      req.userPermissions = ["tasks:view:own"];
      req.query = {} as any;

      await TaskController.listEmployeeTasks(req as Request, res);

      expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: "auth-user-id",
        }),
      );
    });

    it("allows a tasks:view:any caller to list broadly within the org", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      req.userPermissions = ["tasks:view:any"];
      req.query = { assignedTo: "other-user-id" } as any;

      await TaskController.listEmployeeTasks(req as Request, res);

      expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org-1",
          assignedTo: "other-user-id",
        }),
      );
    });

    it("parses shared list filters and drops junk values", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      req.userPermissions = ["tasks:view:any"];
      req.query = {
        appointmentId: ["appt-1", "appt-2"],
        encounterId: "enc-1",
        status: "PENDING,COMPLETED,NOT_A_STATUS",
        kind: "MEDICATION",
        subcategory: "dental",
        fromDueAt: "2026-01-01T00:00:00.000Z",
        dueTo: "2026-01-31T00:00:00.000Z",
        includeCompleted: "junk",
      } as any;

      await TaskController.listEmployeeTasks(req as Request, res);

      expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: "appt-1",
          encounterId: "enc-1",
          status: ["PENDING", "COMPLETED"],
          kind: "MEDICATION",
          subcategory: "dental",
          dueFrom: new Date("2026-01-01T00:00:00.000Z"),
          dueTo: new Date("2026-01-31T00:00:00.000Z"),
          includeCompleted: undefined,
        }),
      );
    });

    it("maps a TaskServiceError from the service to its status code", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      req.userPermissions = ["tasks:view:any"];
      req.query = {} as any;
      mockedTaskService.listForEmployee.mockRejectedValueOnce(
        new TaskServiceError("Not allowed", 403) as never,
      );

      await TaskController.listEmployeeTasks(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Not allowed" });
    });

    it("passes a valid priority filter through and drops an invalid one", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      req.userPermissions = ["tasks:view:any"];
      req.query = { priority: "URGENT" } as any;

      await TaskController.listEmployeeTasks(req as Request, res);
      expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(
        expect.objectContaining({ priority: "URGENT" }),
      );

      mockedTaskService.listForEmployee.mockClear();
      req.query = { priority: "SOMETHING" } as any;

      await TaskController.listEmployeeTasks(req as Request, res);
      expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(
        expect.objectContaining({ priority: undefined }),
      );
    });
  });

  describe("updateTaskPMS", () => {
    it("passes recurrence scope through to the service", async () => {
      req.userId = "auth-user-id";
      req.query = { scope: "THIS_AND_FOLLOWING" } as any;
      mockedTaskService.updateTask.mockResolvedValue({ ok: true } as any);

      await TaskController.updateTaskPMS(req as Request, res);

      expect(mockedTaskService.updateTask).toHaveBeenCalledWith(
        "task-1",
        req.body,
        "auth-user-id",
        "THIS_AND_FOLLOWING",
        undefined,
      );
      expect(jsonMock).toHaveBeenCalledWith({ ok: true });
    });

    it("defaults to THIS when scope is absent or invalid", async () => {
      req.userId = "auth-user-id";
      req.query = { scope: "INVALID" } as any;
      mockedTaskService.updateTask.mockResolvedValue({ ok: true } as any);

      await TaskController.updateTaskPMS(req as Request, res);

      expect(mockedTaskService.updateTask).toHaveBeenCalledWith(
        "task-1",
        req.body,
        "auth-user-id",
        "THIS",
        undefined,
      );
    });
  });

  describe("deleteTaskPMS", () => {
    it("invokes deleteTask with the selected recurrence scope and org scope", async () => {
      req.userId = "auth-user-id";
      (req as unknown as { organisationId?: string }).organisationId = "org-1";
      req.query = { scope: "ALL" } as any;
      mockedTaskService.deleteTask.mockResolvedValue(undefined as any);

      await TaskController.deleteTaskPMS(req as Request, res);

      // The org scope must reach the service: without it the initial task
      // lookup is unscoped.
      expect(mockedTaskService.deleteTask).toHaveBeenCalledWith(
        "task-1",
        "auth-user-id",
        "ALL",
        "org-1",
      );
      expect(statusMock).toHaveBeenCalledWith(204);
    });
  });
});
