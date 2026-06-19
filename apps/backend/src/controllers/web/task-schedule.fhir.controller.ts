import { Request, Response } from "express";
import { Bundle, Parameters } from "@yosemite-crew/fhir";
import { z } from "zod";
import {
  TaskWorkflowService,
  TaskWorkflowServiceError,
} from "src/services/task-workflow.service";
import {
  taskScheduleFhirMapper,
  type TaskScheduleLike,
} from "src/services/task-schedule.fhir.mapper";
import { createFhirErrorHandler } from "src/controllers/web/fhir-controller.shared";
import { resolveUserIdFromRequest } from "src/utils/request";

const parametersSchema = z
  .object({ resourceType: z.literal("Parameters") })
  .passthrough();

const handleError = createFhirErrorHandler({
  isServiceError: (error): error is TaskWorkflowServiceError =>
    error instanceof TaskWorkflowServiceError,
  invalidPayloadMessage: "Invalid FHIR payload.",
  logMessage: "Unexpected FHIR task schedule error",
});

const parseParameters = (body: unknown) => {
  if (!body || typeof body !== "object") return undefined;
  if ((body as { resourceType?: string }).resourceType !== "Parameters") {
    return undefined;
  }
  return parametersSchema.parse(body) as unknown as Parameters;
};

const buildScheduleBundle = (schedules: TaskScheduleLike[]): Bundle => ({
  resourceType: "Bundle",
  type: "searchset",
  total: schedules.length,
  entry: schedules.map((schedule) => ({
    resource: taskScheduleFhirMapper.toTask(schedule),
  })),
});

export const TaskScheduleFhirController = {
  async listEncounterSchedules(req: Request, res: Response) {
    try {
      const schedules = await TaskWorkflowService.listSchedulesForEncounter(
        req.params.organisationId,
        req.params.encounterId,
      );
      return res.status(200).json(buildScheduleBundle(schedules));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async apply(req: Request, res: Response) {
    try {
      const parameters = parseParameters(req.body);
      const record = await TaskWorkflowService.launchFromTemplateInstance(
        req.params.instanceId,
        req.params.organisationId,
        resolveUserIdFromRequest(req) ?? "",
        {
          force: taskScheduleFhirMapper.getBooleanParameter(
            parameters,
            "force",
          ),
          notify: taskScheduleFhirMapper.getBooleanParameter(
            parameters,
            "notify",
          ),
          deferUntil: taskScheduleFhirMapper.getDateParameter(
            parameters,
            "deferUntil",
          ),
        },
      );

      return res
        .status(200)
        .json(
          taskScheduleFhirMapper.toTask(
            record.schedule as TaskScheduleLike,
            record.taskIds,
          ),
        );
    } catch (error) {
      return handleError(error, res);
    }
  },

  async pause(req: Request, res: Response) {
    try {
      const schedule = await TaskWorkflowService.pauseSchedule(
        req.params.instanceId,
        resolveUserIdFromRequest(req) ?? "",
        req.params.organisationId,
      );
      return res
        .status(200)
        .json(taskScheduleFhirMapper.toTask(schedule as TaskScheduleLike));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async resume(req: Request, res: Response) {
    try {
      const schedule = await TaskWorkflowService.resumeSchedule(
        req.params.instanceId,
        resolveUserIdFromRequest(req) ?? "",
        req.params.organisationId,
      );
      return res
        .status(200)
        .json(taskScheduleFhirMapper.toTask(schedule as TaskScheduleLike));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async cancel(req: Request, res: Response) {
    try {
      const schedule = await TaskWorkflowService.cancelSchedule(
        req.params.instanceId,
        resolveUserIdFromRequest(req) ?? "",
        req.params.organisationId,
      );
      return res
        .status(200)
        .json(taskScheduleFhirMapper.toTask(schedule as TaskScheduleLike));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async regenerate(req: Request, res: Response) {
    try {
      const parameters = parseParameters(req.body);
      const record = await TaskWorkflowService.regenerateSchedule(
        req.params.instanceId,
        req.params.organisationId,
        resolveUserIdFromRequest(req) ?? "",
        {
          force: true,
          notify: taskScheduleFhirMapper.getBooleanParameter(
            parameters,
            "notify",
          ),
          deferUntil: taskScheduleFhirMapper.getDateParameter(
            parameters,
            "deferUntil",
          ),
        },
      );
      return res
        .status(200)
        .json(
          taskScheduleFhirMapper.toTask(
            record.schedule as TaskScheduleLike,
            record.taskIds,
          ),
        );
    } catch (error) {
      return handleError(error, res);
    }
  },
};
