import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { TaskController } from "../../../src/controllers/web/task.controller";
import { TaskService } from "../../../src/services/task.service";

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
    },
  };
});

const mockedTaskService = jest.mocked(TaskService);

describe("TaskController", () => {
  type TestRequest = Partial<Request> & { userId?: string };
  let req: TestRequest;
  let res: Response;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      params: { taskId: "task-1" },
      body: { status: "COMPLETED", completion: { notes: "done" } },
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
      req.headers = { "x-user-id": "spoofed-user-id" } as any;
      mockedTaskService.changeStatus.mockResolvedValue({ ok: true } as any);

      await TaskController.changeStatusPMS(req as Request, res);

      expect(mockedTaskService.changeStatus).toHaveBeenCalledWith(
        "task-1",
        "COMPLETED",
        "auth-user-id",
        { notes: "done" },
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
      );
    });
  });

  describe("deleteTaskPMS", () => {
    it("invokes deleteTask with the selected recurrence scope", async () => {
      req.userId = "auth-user-id";
      req.query = { scope: "ALL" } as any;
      mockedTaskService.deleteTask.mockResolvedValue(undefined as any);

      await TaskController.deleteTaskPMS(req as Request, res);

      expect(mockedTaskService.deleteTask).toHaveBeenCalledWith(
        "task-1",
        "auth-user-id",
        "ALL",
      );
      expect(statusMock).toHaveBeenCalledWith(204);
    });
  });
});
