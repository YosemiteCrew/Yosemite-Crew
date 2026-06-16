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
    };
    mockedMapper.getBooleanParameter.mockReturnValue(false);
    mockedMapper.getDateParameter.mockReturnValue(undefined);
    mockedMapper.toTask.mockReturnValue({ resourceType: "Task" } as never);
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

    expect(mockedService.launchFromTemplateInstance).toHaveBeenCalledWith(
      "instance-1",
      "org-1",
      "",
      expect.objectContaining({ force: false }),
    );
    expect(mockedService.pauseSchedule).toHaveBeenCalledWith(
      "instance-1",
      "",
      "org-1",
    );
    expect(mockedService.regenerateSchedule).toHaveBeenCalledWith(
      "instance-1",
      "org-1",
      "",
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
});
