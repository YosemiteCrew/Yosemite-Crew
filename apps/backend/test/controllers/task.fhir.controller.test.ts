import { beforeEach, describe, expect, jest, it } from "@jest/globals";
import type { Request, Response } from "express";
import { TaskFhirController } from "../../src/controllers/web/task.fhir.controller";
import { taskFhirMapper } from "../../src/services/fhir-task.mapper";

jest.mock("../../src/services/task.service", () => {
  const actual = jest.requireActual(
    "../../src/services/task.service",
  ) as Record<string, unknown>;
  return {
    ...(actual as object),
    TaskService: {
      getById: jest.fn(),
      listForEmployee: jest.fn(),
      listForCompanion: jest.fn(),
      createCustom: jest.fn(),
      changeStatus: jest.fn(),
      updateTask: jest.fn(),
    },
  };
});
jest.mock("../../src/services/fhir-task.mapper", () => ({
  taskFhirMapper: {
    fromTaskStatus: jest.fn((status) => status),
    listBundle: jest.fn((tasks) => tasks),
    toFhirTask: jest.fn((task) => task),
  },
}));

const { TaskService } = jest.requireMock("../../src/services/task.service") as {
  TaskService: {
    getById: jest.Mock;
    listForEmployee: jest.Mock;
    listForCompanion: jest.Mock;
    createCustom: jest.Mock;
    changeStatus: jest.Mock;
    updateTask: jest.Mock;
  };
};
const mockedTaskService = TaskService as any;
const mockedTaskFhirMapper = jest.mocked(taskFhirMapper);

const buildResponse = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { json, status } as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
  };
};

describe("TaskFhirController", () => {
  let req: Partial<Request>;
  let res: ReturnType<typeof buildResponse>;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: {}, params: {}, body: {}, query: {} };
    res = buildResponse();
  });

  it("limits own-scope task lists to the authenticated actor", async () => {
    (req as any).userId = "actor-1";
    (req as any).userPermissions = ["tasks:view:own"];
    req.params = { organisationId: "org-1" };
    req.query = { status: "PENDING" };
    mockedTaskService.listForEmployee.mockResolvedValue([
      { id: "task-1" },
    ] as any);

    await TaskFhirController.listEmployeeTasks(req as any, res as any);

    expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        userId: "actor-1",
        status: ["PENDING"],
      }),
    );
    expect(mockedTaskFhirMapper.listBundle).toHaveBeenCalledWith([
      { id: "task-1" },
    ]);
  });

  it("returns all tasks for any-scope task lists", async () => {
    (req as any).userId = "actor-1";
    (req as any).userPermissions = ["tasks:view:any"];
    req.params = { organisationId: "org-1" };
    mockedTaskService.listForEmployee.mockResolvedValue([
      { id: "task-1" },
    ] as any);

    await TaskFhirController.listEmployeeTasks(req as any, res as any);

    expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        userId: undefined,
      }),
    );
  });

  it("blocks own-scope detail reads for tasks owned by another actor", async () => {
    (req as any).userId = "actor-1";
    (req as any).userPermissions = ["tasks:view:own"];
    req.params = { organisationId: "org-1", taskId: "task-1" };
    mockedTaskService.getById.mockResolvedValue({
      id: "task-1",
      assignedTo: "actor-2",
      createdBy: "actor-2",
      organisationId: "org-1",
    } as any);

    await TaskFhirController.getById(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows any-scope detail reads for tasks", async () => {
    (req as any).userId = "actor-1";
    (req as any).userPermissions = ["tasks:view:any"];
    req.params = { organisationId: "org-1", taskId: "task-1" };
    mockedTaskService.getById.mockResolvedValue({
      id: "task-1",
      assignedTo: "actor-2",
      createdBy: "actor-2",
      organisationId: "org-1",
    } as any);

    await TaskFhirController.getById(req as any, res as any);

    expect(mockedTaskFhirMapper.toFhirTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1" }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
