import { Request, Response } from "express";
import { Parameters } from "@yosemite-crew/fhir";
import { z } from "zod";
import { AuthenticatedRequest } from "src/middlewares/auth";
import {
  TaskWorkflowService,
  TaskWorkflowServiceError,
} from "src/services/task-workflow.service";
import {
  taskScheduleFhirMapper,
  type TaskScheduleLike,
} from "src/services/task-schedule.fhir.mapper";
import logger from "src/utils/logger";

const parametersSchema = z
  .object({ resourceType: z.literal("Parameters") })
  .passthrough();

const handleError = (error: unknown, res: Response) => {
  if (error instanceof TaskWorkflowServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid FHIR payload.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  logger.error("Unexpected FHIR task schedule error", error);
  return res.status(500).json({ message: "Internal Server Error" });
};

const resolveUserId = (req: Request) => {
  const typed = req as AuthenticatedRequest;
  return typeof typed.userId === "string" ? typed.userId : "";
};

const parseParameters = (body: unknown) => {
  if (!body || typeof body !== "object") return undefined;
  if ((body as { resourceType?: string }).resourceType !== "Parameters") {
    return undefined;
  }
  return parametersSchema.parse(body) as unknown as Parameters;
};

export const TaskScheduleFhirController = {
  async apply(req: Request, res: Response) {
    try {
      const parameters = parseParameters(req.body);
      const record = await TaskWorkflowService.launchFromTemplateInstance(
        req.params.instanceId,
        req.params.organisationId,
        resolveUserId(req),
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
        resolveUserId(req),
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
        resolveUserId(req),
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
        resolveUserId(req),
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
        resolveUserId(req),
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
