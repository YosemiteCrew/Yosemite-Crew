import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { TaskFhirController } from "../../../src/controllers/web/task.fhir.controller";
import { TaskService } from "../../../src/services/task.service";
import logger from "../../../src/utils/logger";

// Only the service layer is faked: the FHIR mapper runs for real so these
// tests assert on the emitted resource shape, not just the HTTP status.
jest.mock("../../../src/services/task.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/task.service",
  ) as typeof import("../../../src/services/task.service");
  return {
    ...actual,
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

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const EXT = "https://yosemitecrew.com/fhir/StructureDefinition";

const mockedTaskService = jest.mocked(TaskService);
const mockedLogger = jest.mocked(logger);

const taskRow = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  _id: "task-1",
  organisationId: "org-1",
  patientId: "comp-1",
  createdBy: "actor-1",
  assignedBy: "actor-1",
  assignedTo: "actor-1",
  assignedGroupId: null,
  audience: "EMPLOYEE_TASK",
  source: "CUSTOM",
  category: "CARE",
  name: "Check vitals",
  description: "Check vitals twice daily",
  status: "PENDING",
  dueAt: new Date("2026-02-01T09:00:00.000Z"),
  createdAt: new Date("2026-01-01T09:00:00.000Z"),
  updatedAt: new Date("2026-01-02T09:00:00.000Z"),
  ...overrides,
});

const fhirTaskBody = (overrides: Record<string, unknown> = {}) => ({
  resourceType: "Task",
  status: "requested",
  intent: "order",
  description: "Check vitals twice daily",
  owner: { reference: "Practitioner/actor-2" },
  code: { text: "CARE" },
  extension: [
    { url: `${EXT}/task-category`, valueString: "CARE" },
    { url: `${EXT}/task-audience`, valueString: "PARENT_TASK" },
    { url: `${EXT}/task-companion`, valueString: "comp-1" },
    {
      url: `${EXT}/task-due-at`,
      valueDateTime: "2026-02-01T09:00:00.000Z",
    },
  ],
  ...overrides,
});

describe("TaskFhirController", () => {
  type TestRequest = Partial<Request> & {
    userId?: string;
    userPermissions?: string[];
    organisationId?: string;
  };
  let req: TestRequest;
  let res: Response & { status: jest.Mock; json: jest.Mock };
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = { status: statusMock, json: jsonMock } as unknown as Response & {
      status: jest.Mock;
      json: jest.Mock;
    };
    req = {
      headers: {},
      params: {},
      body: {},
      query: {},
    };
  });

  type EmittedFhir = Record<string, unknown> & {
    entry: { resource: Record<string, unknown> }[];
  };
  const emitted = () => jsonMock.mock.calls[0][0] as EmittedFhir;

  describe("listEmployeeTasks", () => {
    it("emits a searchset bundle of Task resources", async () => {
      req.userId = "actor-1";
      req.userPermissions = ["tasks:view:any"];
      req.params = { organisationId: "org-1" };
      mockedTaskService.listForEmployee.mockResolvedValue([
        taskRow(),
        taskRow({ id: "task-2", status: "COMPLETED" }),
      ] as never);

      await TaskFhirController.listEmployeeTasks(req as Request, res);

      const bundle = emitted();
      expect(bundle).toEqual(
        expect.objectContaining({
          resourceType: "Bundle",
          type: "searchset",
          total: 2,
        }),
      );
      expect(bundle.entry[0].resource).toEqual(
        expect.objectContaining({
          resourceType: "Task",
          id: "task-1",
          status: "requested",
          intent: "order",
        }),
      );
      expect(bundle.entry[1].resource.status).toBe("completed");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("translates a comma-separated FHIR status filter into task statuses", async () => {
      req.userId = "actor-1";
      req.userPermissions = ["tasks:view:any"];
      req.params = { organisationId: "org-1" };
      req.query = { status: "completed, in-progress ,cancelled" };
      mockedTaskService.listForEmployee.mockResolvedValue([] as never);

      await TaskFhirController.listEmployeeTasks(req as Request, res);

      expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ["COMPLETED", "IN_PROGRESS", "CANCELLED"],
        }),
      );
    });

    it("accepts a repeated status query parameter as an array", async () => {
      req.userId = "actor-1";
      req.userPermissions = ["tasks:view:any"];
      req.params = { organisationId: "org-1" };
      req.query = { status: ["completed", "accepted"] } as never;
      mockedTaskService.listForEmployee.mockResolvedValue([] as never);

      await TaskFhirController.listEmployeeTasks(req as Request, res);

      expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(
        expect.objectContaining({ status: ["COMPLETED", "IN_PROGRESS"] }),
      );
    });

    it("omits the status filter when the query carries no usable values", async () => {
      req.userId = "actor-1";
      req.userPermissions = ["tasks:view:any"];
      req.params = { organisationId: "org-1" };
      req.query = { status: [] } as never;
      mockedTaskService.listForEmployee.mockResolvedValue([] as never);

      await TaskFhirController.listEmployeeTasks(req as Request, res);

      expect(mockedTaskService.listForEmployee).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined }),
      );
    });

    it("rejects an unidentified caller that holds no any-scope permission", async () => {
      // No userId, no x-user-id header and no permission array at all: the
      // request cannot be scoped to anyone, so it must not list the org.
      req.params = { organisationId: "org-1" };

      await TaskFhirController.listEmployeeTasks(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Forbidden – insufficient permissions",
      });
      expect(mockedTaskService.listForEmployee).not.toHaveBeenCalled();
    });

    it("returns a 400 with issue details for a malformed query", async () => {
      req.userId = "actor-1";
      req.userPermissions = ["tasks:view:any"];
      req.params = { organisationId: "org-1" };
      req.query = { status: { nested: true } } as never;

      await TaskFhirController.listEmployeeTasks(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Invalid FHIR payload." }),
      );
    });

    it("returns a 500 and logs when the service throws an unexpected error", async () => {
      req.userId = "actor-1";
      req.userPermissions = ["tasks:view:any"];
      req.params = { organisationId: "org-1" };
      mockedTaskService.listForEmployee.mockRejectedValue(new Error("boom"));

      await TaskFhirController.listEmployeeTasks(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Unexpected FHIR task error",
        expect.any(Error),
      );
    });
  });

  describe("listCompanionTasks", () => {
    it("emits a bundle scoped to the authorized organisation and audience", async () => {
      req.organisationId = "org-1";
      req.params = { patientId: "comp-1" };
      req.query = { audience: "PARENT_TASK", status: "completed" };
      mockedTaskService.listForCompanion.mockResolvedValue([
        taskRow({ status: "COMPLETED", audience: "PARENT_TASK" }),
      ] as never);

      await TaskFhirController.listCompanionTasks(req as Request, res);

      expect(mockedTaskService.listForCompanion).toHaveBeenCalledWith({
        patientId: "comp-1",
        organisationId: "org-1",
        audience: "PARENT_TASK",
        status: ["COMPLETED"],
      });
      const bundle = emitted();
      expect(bundle.total).toBe(1);
      expect(bundle.entry[0].resource).toEqual(
        expect.objectContaining({
          resourceType: "Task",
          status: "completed",
          for: { reference: "Patient/comp-1" },
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("takes the first value of a repeated audience parameter", async () => {
      req.organisationId = "org-1";
      req.params = { patientId: "comp-1" };
      req.query = { audience: ["EMPLOYEE_TASK", "PARENT_TASK"] } as never;
      mockedTaskService.listForCompanion.mockResolvedValue([] as never);

      await TaskFhirController.listCompanionTasks(req as Request, res);

      expect(mockedTaskService.listForCompanion).toHaveBeenCalledWith(
        expect.objectContaining({ audience: "EMPLOYEE_TASK" }),
      );
    });

    it("drops an audience value outside the known set", async () => {
      req.organisationId = "org-1";
      req.params = { patientId: "comp-1" };
      req.query = { audience: "ADMIN_TASK" };
      mockedTaskService.listForCompanion.mockResolvedValue([] as never);

      await TaskFhirController.listCompanionTasks(req as Request, res);

      expect(mockedTaskService.listForCompanion).toHaveBeenCalledWith(
        expect.objectContaining({ audience: undefined }),
      );
    });

    it("leaves the audience unfiltered when the query omits it", async () => {
      req.organisationId = "org-1";
      req.params = { patientId: "comp-1" };
      mockedTaskService.listForCompanion.mockResolvedValue([] as never);

      await TaskFhirController.listCompanionTasks(req as Request, res);

      expect(mockedTaskService.listForCompanion).toHaveBeenCalledWith(
        expect.objectContaining({ audience: undefined, status: undefined }),
      );
    });

    it("rejects the request when no organisation has been authorized", async () => {
      req.params = { patientId: "comp-1" };

      await TaskFhirController.listCompanionTasks(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Missing organisationId",
      });
      expect(mockedTaskService.listForCompanion).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("maps the FHIR payload onto a custom task and echoes the created resource", async () => {
      req.userId = "actor-1";
      req.params = { organisationId: "org-1" };
      req.body = fhirTaskBody();
      mockedTaskService.createCustom.mockResolvedValue(
        taskRow({ audience: "PARENT_TASK", assignedTo: "actor-2" }) as never,
      );

      await TaskFhirController.create(req as Request, res);

      expect(mockedTaskService.createCustom).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org-1",
          createdBy: "actor-1",
          assignedBy: "actor-1",
          assignedTo: "actor-2",
          audience: "PARENT_TASK",
          patientId: "comp-1",
          category: "CARE",
          dueAt: new Date("2026-02-01T09:00:00.000Z"),
        }),
      );
      // status "requested" maps to PENDING, so no follow-up transition runs.
      expect(mockedTaskService.changeStatus).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(emitted()).toEqual(
        expect.objectContaining({
          resourceType: "Task",
          id: "task-1",
          status: "requested",
          owner: { reference: "Practitioner/actor-2" },
        }),
      );
    });

    it("applies a non-pending FHIR status through a follow-up transition", async () => {
      req.userId = "actor-1";
      req.params = { organisationId: "org-1" };
      req.body = fhirTaskBody({ status: "in-progress" });
      mockedTaskService.createCustom.mockResolvedValue(
        taskRow({ status: "PENDING" }) as never,
      );
      mockedTaskService.changeStatus.mockResolvedValue({
        task: taskRow({ status: "IN_PROGRESS" }),
      } as never);

      await TaskFhirController.create(req as Request, res);

      expect(mockedTaskService.changeStatus).toHaveBeenCalledWith(
        "task-1",
        "IN_PROGRESS",
        "actor-1",
      );
      expect(emitted().status).toBe("accepted");
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("rejects a body that is not a Task resource", async () => {
      req.userId = "actor-1";
      req.params = { organisationId: "org-1" };
      req.body = { resourceType: "Observation" };

      await TaskFhirController.create(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid FHIR payload.",
          issues: expect.arrayContaining([
            expect.objectContaining({ path: "resourceType" }),
          ]),
        }),
      );
      expect(mockedTaskService.createCustom).not.toHaveBeenCalled();
    });

    it("records an empty creator when the request carries no identity", async () => {
      // The route is only reachable behind auth, but the mapper must still
      // produce a well-formed input rather than an undefined createdBy.
      req.params = { organisationId: "org-1" };
      req.body = fhirTaskBody();
      mockedTaskService.createCustom.mockResolvedValue(taskRow() as never);

      await TaskFhirController.create(req as Request, res);

      expect(mockedTaskService.createCustom).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: "", assignedBy: "" }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("surfaces the service status code when creation is refused", async () => {
      req.userId = "actor-1";
      req.params = { organisationId: "org-1" };
      req.body = fhirTaskBody();
      const { TaskServiceError } = jest.requireActual(
        "../../../src/services/task.service",
      ) as typeof import("../../../src/services/task.service");
      mockedTaskService.createCustom.mockRejectedValue(
        new TaskServiceError("patientId is required", 400),
      );

      await TaskFhirController.create(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "patientId is required",
      });
    });
  });

  describe("getById", () => {
    it("returns the FHIR resource for a task the own-scope caller owns", async () => {
      req.userId = "actor-1";
      req.userPermissions = ["tasks:view:own"];
      req.params = { organisationId: "org-1", taskId: "task-1" };
      mockedTaskService.getById.mockResolvedValue(taskRow() as never);

      await TaskFhirController.getById(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted()).toEqual(
        expect.objectContaining({ resourceType: "Task", id: "task-1" }),
      );
    });

    it("404s when the task does not exist", async () => {
      req.userId = "actor-1";
      req.userPermissions = ["tasks:view:any"];
      req.params = { organisationId: "org-1", taskId: "task-x" };
      mockedTaskService.getById.mockResolvedValue(null as never);

      await TaskFhirController.getById(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Task not found" });
    });

    it("403s when the task belongs to another organisation", async () => {
      // Cross-tenant read attempt: the route org and the task org disagree.
      req.userId = "actor-1";
      req.userPermissions = ["tasks:view:any"];
      req.params = { organisationId: "org-2", taskId: "task-1" };
      mockedTaskService.getById.mockResolvedValue(taskRow() as never);

      await TaskFhirController.getById(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Task does not belong to organisation",
      });
    });

    it("treats a caller with no permission array as own-scope only", async () => {
      req.userId = "actor-1";
      req.params = { organisationId: "org-1", taskId: "task-1" };
      mockedTaskService.getById.mockResolvedValue(
        taskRow({ createdBy: "other", assignedTo: "other" }) as never,
      );

      await TaskFhirController.getById(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Forbidden – insufficient permissions",
      });
    });
  });

  describe("update", () => {
    it("maps the FHIR payload onto a task update and echoes the resource", async () => {
      req.userId = "actor-1";
      req.params = { organisationId: "org-1", taskId: "task-1" };
      req.body = fhirTaskBody({ description: "Renamed task" });
      mockedTaskService.getById.mockResolvedValue(taskRow() as never);
      mockedTaskService.updateTask.mockResolvedValue(
        taskRow({ description: "Renamed task" }) as never,
      );

      await TaskFhirController.update(req as Request, res);

      expect(mockedTaskService.updateTask).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({
          name: "Renamed task",
          description: "Renamed task",
          assignedTo: "actor-2",
          dueAt: new Date("2026-02-01T09:00:00.000Z"),
        }),
        "actor-1",
      );
      expect(mockedTaskService.changeStatus).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted()).toEqual(
        expect.objectContaining({
          resourceType: "Task",
          description: "Renamed task",
        }),
      );
    });

    it("applies a non-pending status after the update", async () => {
      req.userId = "actor-1";
      req.params = { organisationId: "org-1", taskId: "task-1" };
      req.body = fhirTaskBody({ status: "completed" });
      mockedTaskService.getById.mockResolvedValue(taskRow() as never);
      mockedTaskService.updateTask.mockResolvedValue(taskRow() as never);
      mockedTaskService.changeStatus.mockResolvedValue({
        task: taskRow({ status: "COMPLETED" }),
      } as never);

      await TaskFhirController.update(req as Request, res);

      expect(mockedTaskService.changeStatus).toHaveBeenCalledWith(
        "task-1",
        "COMPLETED",
        "actor-1",
      );
      expect(emitted().status).toBe("completed");
    });

    it("refuses to update a task the own-scope caller does not own", async () => {
      req.userId = "actor-1";
      req.userPermissions = ["tasks:edit:own"];
      req.params = { organisationId: "org-1", taskId: "task-1" };
      req.body = fhirTaskBody();
      mockedTaskService.getById.mockResolvedValue(
        taskRow({ createdBy: "other", assignedTo: "other" }) as never,
      );

      await TaskFhirController.update(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockedTaskService.updateTask).not.toHaveBeenCalled();
    });

    it("rejects a body that is not a Task resource", async () => {
      req.userId = "actor-1";
      req.params = { organisationId: "org-1", taskId: "task-1" };
      req.body = { resourceType: "Patient" };

      await TaskFhirController.update(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockedTaskService.getById).not.toHaveBeenCalled();
    });

    it("forwards an empty actor id when the request carries no identity", async () => {
      // The controller's own-scope check is skipped for an empty actor, so the
      // service is the layer that has to reject the write.
      req.params = { organisationId: "org-1", taskId: "task-1" };
      req.body = fhirTaskBody();
      mockedTaskService.getById.mockResolvedValue(taskRow() as never);
      mockedTaskService.updateTask.mockResolvedValue(taskRow() as never);

      await TaskFhirController.update(req as Request, res);

      expect(mockedTaskService.updateTask).toHaveBeenCalledWith(
        "task-1",
        expect.any(Object),
        "",
      );
    });
  });

  describe("changeStatus", () => {
    it("applies the FHIR status and echoes the updated resource", async () => {
      req.userId = "actor-1";
      req.userPermissions = ["tasks:view:any"];
      req.params = { organisationId: "org-1", taskId: "task-1" };
      req.body = { resourceType: "Task", status: "cancelled" };
      mockedTaskService.getById.mockResolvedValue(taskRow() as never);
      mockedTaskService.changeStatus.mockResolvedValue({
        task: taskRow({ status: "CANCELLED" }),
      } as never);

      await TaskFhirController.changeStatus(req as Request, res);

      expect(mockedTaskService.changeStatus).toHaveBeenCalledWith(
        "task-1",
        "CANCELLED",
        "actor-1",
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(emitted()).toEqual(
        expect.objectContaining({ resourceType: "Task", status: "cancelled" }),
      );
    });

    it("defaults an unknown FHIR status to PENDING", async () => {
      req.userId = "actor-1";
      req.userPermissions = ["tasks:view:any"];
      req.params = { organisationId: "org-1", taskId: "task-1" };
      req.body = { resourceType: "Task", status: "on-hold" };
      mockedTaskService.getById.mockResolvedValue(taskRow() as never);
      mockedTaskService.changeStatus.mockResolvedValue({
        task: taskRow(),
      } as never);

      await TaskFhirController.changeStatus(req as Request, res);

      expect(mockedTaskService.changeStatus).toHaveBeenCalledWith(
        "task-1",
        "PENDING",
        "actor-1",
      );
    });

    it("treats a caller with no permission array as own-scope and forwards an empty actor", async () => {
      req.params = { organisationId: "org-1", taskId: "task-1" };
      req.body = { resourceType: "Task", status: "completed" };
      mockedTaskService.getById.mockResolvedValue(taskRow() as never);
      mockedTaskService.changeStatus.mockResolvedValue({
        task: taskRow({ status: "COMPLETED" }),
      } as never);

      await TaskFhirController.changeStatus(req as Request, res);

      expect(mockedTaskService.changeStatus).toHaveBeenCalledWith(
        "task-1",
        "COMPLETED",
        "",
      );
    });

    it("404s before touching the service when the task does not exist", async () => {
      req.userId = "actor-1";
      req.userPermissions = ["tasks:view:any"];
      req.params = { organisationId: "org-1", taskId: "task-x" };
      req.body = { resourceType: "Task", status: "completed" };
      mockedTaskService.getById.mockResolvedValue(null as never);

      await TaskFhirController.changeStatus(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(mockedTaskService.changeStatus).not.toHaveBeenCalled();
    });

    it("rejects a body that is not a Task resource", async () => {
      req.userId = "actor-1";
      req.params = { organisationId: "org-1", taskId: "task-1" };
      req.body = { resourceType: "Bundle" };

      await TaskFhirController.changeStatus(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockedTaskService.getById).not.toHaveBeenCalled();
    });
  });
});
