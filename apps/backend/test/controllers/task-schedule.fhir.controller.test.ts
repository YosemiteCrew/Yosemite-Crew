import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { TaskScheduleFhirController } from "../../src/controllers/web/task-schedule.fhir.controller";
import {
  TaskWorkflowService,
  TaskWorkflowServiceError,
} from "../../src/services/task-workflow.service";
import { taskScheduleFhirMapper } from "../../src/services/task-schedule.fhir.mapper";

jest.mock("../../src/services/task-workflow.service", () => {
  const actual = jest.requireActual(
    "../../src/services/task-workflow.service",
  ) as typeof import("../../src/services/task-workflow.service");

  return {
    TaskWorkflowService: {
      listSchedulesForEncounter: jest.fn(),
      launchFromTemplateInstance: jest.fn(),
      pauseSchedule: jest.fn(),
      resumeSchedule: jest.fn(),
      cancelSchedule: jest.fn(),
      regenerateSchedule: jest.fn(),
    },
    TaskWorkflowServiceError: actual.TaskWorkflowServiceError,
  };
});

jest.mock("../../src/services/task-schedule.fhir.mapper", () => ({
  taskScheduleFhirMapper: {
    toTask: jest.fn(),
    getBooleanParameter: jest.fn(),
    getDateParameter: jest.fn(),
  },
}));

const mockedService = TaskWorkflowService as jest.Mocked<
  typeof TaskWorkflowService
>;
const mockedMapper = taskScheduleFhirMapper as jest.Mocked<
  typeof taskScheduleFhirMapper
>;

describe("TaskScheduleFhirController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;
    req = {
      params: {
        organisationId: "org-1",
        instanceId: "instance-1",
      },
      body: {
        resourceType: "Parameters",
      },
      headers: {},
      query: {},
      userId: "actor-1",
      userPermissions: ["tasks:edit:any"],
    } as unknown as Partial<Request>;
    mockedMapper.getBooleanParameter.mockReturnValue(false);
    mockedMapper.getDateParameter.mockReturnValue(undefined);
    mockedMapper.toTask.mockReturnValue({ resourceType: "Task" } as never);
  });

  it("lists encounter schedules as a FHIR bundle", async () => {
    mockedService.listSchedulesForEncounter.mockResolvedValueOnce([
      { id: "schedule-1" },
      { id: "schedule-2" },
    ] as never);

    await TaskScheduleFhirController.listEncounterSchedules(
      {
        ...req,
        params: {
          organisationId: "org-1",
          encounterId: "enc-1",
        },
      } as Request,
      res as Response,
    );

    expect(mockedService.listSchedulesForEncounter).toHaveBeenCalledWith(
      "org-1",
      "enc-1",
    );
    expect(mockedMapper.toTask).toHaveBeenCalledTimes(2);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "Bundle",
        type: "searchset",
        total: 2,
        entry: [
          { resource: { resourceType: "Task" } },
          { resource: { resourceType: "Task" } },
        ],
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("applies, pauses, resumes, cancels, and regenerates schedules", async () => {
    mockedService.launchFromTemplateInstance.mockResolvedValueOnce({
      schedule: { id: "schedule-1", status: "ACTIVE" },
      taskIds: ["task-1"],
      seedCount: 1,
    } as never);
    mockedService.pauseSchedule.mockResolvedValueOnce({
      id: "schedule-1",
      status: "PAUSED",
    } as never);
    mockedService.resumeSchedule.mockResolvedValueOnce({
      id: "schedule-1",
      status: "ACTIVE",
    } as never);
    mockedService.cancelSchedule.mockResolvedValueOnce({
      id: "schedule-1",
      status: "CANCELLED",
    } as never);
    mockedService.regenerateSchedule.mockResolvedValueOnce({
      schedule: { id: "schedule-1", status: "ACTIVE" },
      taskIds: ["task-2"],
      seedCount: 1,
    } as never);

    await TaskScheduleFhirController.apply(req as Request, res as Response);
    await TaskScheduleFhirController.pause(req as Request, res as Response);
    await TaskScheduleFhirController.resume(req as Request, res as Response);
    await TaskScheduleFhirController.cancel(req as Request, res as Response);
    await TaskScheduleFhirController.regenerate(
      req as Request,
      res as Response,
    );

    const actor = { actorId: "actor-1", canEditAny: true };
    expect(mockedService.launchFromTemplateInstance).toHaveBeenCalledWith(
      "instance-1",
      "org-1",
      actor,
      expect.objectContaining({ force: false }),
    );
    expect(mockedService.pauseSchedule).toHaveBeenCalledWith(
      "instance-1",
      actor,
      "org-1",
    );
    expect(mockedService.regenerateSchedule).toHaveBeenCalledWith(
      "instance-1",
      "org-1",
      actor,
      expect.objectContaining({ force: true }),
    );
    expect(mockedMapper.toTask).toHaveBeenCalledTimes(5);
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("returns service errors and validation failures", async () => {
    mockedService.launchFromTemplateInstance.mockRejectedValueOnce(
      new TaskWorkflowServiceError("boom", 409),
    );
    await TaskScheduleFhirController.apply(req as Request, res as Response);
    expect(statusMock).toHaveBeenCalledWith(409);

    mockedService.launchFromTemplateInstance.mockRejectedValueOnce(
      new Error("boom"),
    );
    await TaskScheduleFhirController.apply(
      {
        ...req,
        body: { resourceType: "Observation" },
      } as Request,
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(500);
  });

  it("passes no parameters through when the body is absent or not an object", async () => {
    const record = {
      schedule: { id: "schedule-1", status: "ACTIVE" },
      taskIds: [],
      seedCount: 0,
    };
    mockedService.launchFromTemplateInstance.mockResolvedValue(record as never);
    mockedService.regenerateSchedule.mockResolvedValue(record as never);

    await TaskScheduleFhirController.apply(
      { ...req, body: undefined } as Request,
      res as Response,
    );
    await TaskScheduleFhirController.regenerate(
      { ...req, body: "Parameters" } as unknown as Request,
      res as Response,
    );

    expect(mockedMapper.getBooleanParameter).toHaveBeenCalledWith(
      undefined,
      "force",
    );
    expect(mockedMapper.getDateParameter).toHaveBeenCalledWith(
      undefined,
      "deferUntil",
    );
    expect(statusMock).toHaveBeenCalledTimes(2);
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("defaults the actor to an unidentified, own-scope caller", async () => {
    mockedService.cancelSchedule.mockResolvedValueOnce({
      id: "schedule-1",
      status: "CANCELLED",
    } as never);

    await TaskScheduleFhirController.cancel(
      { ...req, userId: undefined, userPermissions: undefined } as Request,
      res as Response,
    );

    expect(mockedService.cancelSchedule).toHaveBeenCalledWith(
      "instance-1",
      { actorId: "", canEditAny: false },
      "org-1",
    );
  });

  it.each([
    ["listEncounterSchedules", "listSchedulesForEncounter"],
    ["pause", "pauseSchedule"],
    ["resume", "resumeSchedule"],
    ["cancel", "cancelSchedule"],
    ["regenerate", "regenerateSchedule"],
  ])(
    "maps a service error raised by %s to its status code",
    async (handler, serviceMethod) => {
      (
        mockedService[serviceMethod as keyof typeof mockedService] as jest.Mock
      ).mockRejectedValueOnce(
        new TaskWorkflowServiceError("nope", 404) as never,
      );

      await (
        TaskScheduleFhirController[
          handler as keyof typeof TaskScheduleFhirController
        ] as (req: Request, res: Response) => Promise<unknown>
      )(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "nope" });
    },
  );

  it("maps an unexpected error raised by a schedule handler to a 500", async () => {
    mockedService.resumeSchedule.mockRejectedValueOnce(new Error("boom"));

    await TaskScheduleFhirController.resume(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });

  // The permission set decides whether the service enforces schedule ownership,
  // so it must be read from the verified session, not from the request payload.
  it("threads the actor's permissions from the session, not the client", async () => {
    mockedService.pauseSchedule.mockResolvedValueOnce({
      id: "schedule-1",
      status: "PAUSED",
    } as never);

    const ownOnlyReq = {
      ...req,
      userId: "actor-2",
      userPermissions: ["tasks:edit:own"],
      query: { userId: "spoofed" },
      headers: { "x-user-id": "spoofed" },
    } as unknown as Request;

    await TaskScheduleFhirController.pause(ownOnlyReq, res as Response);

    expect(mockedService.pauseSchedule).toHaveBeenCalledWith(
      "instance-1",
      { actorId: "actor-2", canEditAny: false },
      "org-1",
    );
  });
});
