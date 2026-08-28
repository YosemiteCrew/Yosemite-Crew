import { Request, Response } from "express";
import { z } from "zod";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { resolveVerifiedUserId } from "src/utils/request";
import { OrgRequest } from "src/middlewares/rbac";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import {
  ObservationToolDefinitionService,
  ObservationToolDefinitionServiceError,
} from "src/services/observationToolDefinition.service";
import {
  ObservationToolSubmissionService,
  ObservationToolSubmissionServiceError,
} from "src/services/observationToolSubmission.service";
import type {
  CreateObservationToolDefinitionInput,
  UpdateObservationToolDefinitionInput,
} from "src/services/observationToolDefinition.service";
import type { CreateObservationToolSubmissionInput } from "src/services/observationToolSubmission.service";
import { TaskService } from "src/services/task.service";

const handleError = (error: unknown, res: Response) => {
  if (error instanceof ObservationToolDefinitionServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  if (error instanceof ObservationToolSubmissionServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  console.error(error);
  const errorMessage = error instanceof Error ? error.message : undefined;
  return res
    .status(500)
    .json({ message: "Internal Server Error", error: errorMessage });
};

// Verified session only - the `x-user-id` header fallback this used to carry
// let an unauthenticated or optional-session caller name any user.
const resolveUserId = (req: Request): string | undefined =>
  resolveVerifiedUserId(req);

const CreateAppointmentSubmissionSchema = z.object({
  toolId: z.string().min(1),
  companionId: z.string().min(1),
  answers: z.record(z.string(), z.unknown()),
  taskId: z.string().min(1).optional(),
  summary: z.string().optional(),
});

export const ObservationToolDefinitionController = {
  // PMS — create definition
  create: async (req: Request, res: Response) => {
    try {
      const input = req.body as CreateObservationToolDefinitionInput;
      const doc = await ObservationToolDefinitionService.create(input);
      res.status(201).json(doc);
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS — update
  update: async (req: Request, res: Response) => {
    try {
      const id = req.params.toolId;
      const input = req.body as UpdateObservationToolDefinitionInput;
      const doc = await ObservationToolDefinitionService.update(id, input);
      res.json(doc);
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS — archive
  archive: async (req: Request, res: Response) => {
    try {
      await ObservationToolDefinitionService.archive(req.params.toolId);
      res.status(204).send();
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS + Mobile — list tools (YC library style)
  list: async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const onlyActive =
        req.query.onlyActive === "true" || req.query.onlyActive === "1";
      const docs = await ObservationToolDefinitionService.list({
        category,
        onlyActive,
      });
      res.json(docs);
    } catch (error) {
      handleError(error, res);
    }
  },

  getById: async (req: Request, res: Response) => {
    try {
      const doc = await ObservationToolDefinitionService.getById(
        req.params.toolId,
      );
      res.json(doc);
    } catch (error) {
      handleError(error, res);
    }
  },
};

export const ObservationToolSubmissionController = {
  // MOBILE — Parent submits OT
  createFromMobile: async (req: Request, res: Response) => {
    try {
      const providerUserId = resolveUserId(req);
      if (!providerUserId) {
        return res.status(401).json({ message: "Unauthenticated" });
      }

      const authUser =
        await AuthUserMobileService.getByProviderUserId(providerUserId);
      const parentId = authUser?.parentId?.toString();
      if (!parentId) {
        return res.status(403).json({ message: "Parent not found" });
      }

      const toolId = req.params.toolId;

      const { patientId, taskId, answers, summary } = req.body as {
        patientId: string;
        taskId?: string;
        answers: CreateObservationToolSubmissionInput["answers"];
        summary?: string;
      };

      if (!patientId) {
        return res.status(400).json({ message: "patientId is required" });
      }
      if (!answers || typeof answers !== "object") {
        return res.status(400).json({ message: "answers are required" });
      }

      const submission =
        await ObservationToolSubmissionService.createSubmission({
          toolId,
          taskId,
          patientId,
          filledBy: parentId,
          answers,
          summary,
        });

      res.status(201).json(submission);
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS — list submissions (per companion / tool)
  listForPms: async (req: Request, res: Response) => {
    try {
      const { patientId } = req.query as { patientId?: string };
      const toolId = req.query.toolId as string | undefined;
      const fromDate = req.query.fromDate
        ? new Date(req.query.fromDate as string)
        : undefined;
      const toDate = req.query.toDate
        ? new Date(req.query.toDate as string)
        : undefined;
      const organisationId = (req as OrgRequest).organisationId;

      const submissions =
        await ObservationToolSubmissionService.listSubmissions({
          organisationId,
          patientId: patientId || undefined,
          toolId,
          fromDate,
          toDate,
        });

      res.json(submissions);
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS — get one
  getById: async (req: Request, res: Response) => {
    try {
      const organisationId = (req as OrgRequest).organisationId;
      const submission = await ObservationToolSubmissionService.getById(
        req.params.submissionId,
        organisationId,
      );
      if (!submission) {
        return res
          .status(404)
          .json({ message: "Observation submission not found" });
      }
      res.json(submission);
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS — link submission to evaluation appointment
  linkAppointment: async (req: Request, res: Response) => {
    try {
      const submissionId = req.params.submissionId;
      const organisationId = (req as OrgRequest).organisationId;
      const { appointmentId, enforceSingle } = req.body as {
        appointmentId: string;
        enforceSingle?: boolean;
      };

      const updated = await ObservationToolSubmissionService.linkToAppointment({
        organisationId,
        submissionId,
        appointmentId,
        enforceSingleSubmissionPerAppointment: enforceSingle === true,
      });

      // Observation-tool submissions can exist without a task - the PMS
      // appointment flow creates them directly - so the task link only happens
      // when there is a task to link. The `!` here asserted otherwise and made
      // an ordinary taskless submission fail to link at all.
      if (updated.taskId) {
        await TaskService.linkToAppointment({
          taskId: updated.taskId,
          appointmentId,
        });
      }

      res.json(updated);
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS — list submissions attached to one appointment
  listForAppointment: async (req: Request, res: Response) => {
    try {
      const { appointmentId } = req.params;
      const organisationId = (req as OrgRequest).organisationId;
      const submissions =
        await ObservationToolSubmissionService.listForAppointment(
          appointmentId,
          organisationId,
        );
      res.json(submissions);
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS — clinician creates an observation-tool submission for an appointment
  createForAppointment: async (req: Request, res: Response) => {
    try {
      const { appointmentId } = req.params;
      const organisationId = (req as OrgRequest).organisationId;
      if (!organisationId) {
        return res
          .status(400)
          .json({ message: "Missing organisation context" });
      }

      const filledBy = (req as AuthenticatedRequest).userId;
      if (!filledBy) {
        return res.status(401).json({ message: "Unauthenticated" });
      }

      const parsed = CreateAppointmentSubmissionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const { toolId, companionId, answers, taskId, summary } = parsed.data;

      const submission =
        await ObservationToolSubmissionService.createForAppointment({
          appointmentId,
          organisationId,
          toolId,
          patientId: companionId,
          filledBy,
          answers: answers,
          taskId,
          summary,
        });

      res.status(201).json(submission);
    } catch (error) {
      handleError(error, res);
    }
  },

  getByTaskId: async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const submission =
        await ObservationToolSubmissionService.getByTaskId(taskId);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      res.json(submission);
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS + Mobile — task card preview (definition + submission preview)
  getPreviewByTaskId: async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const preview =
        await ObservationToolSubmissionService.getPreviewByTaskId(taskId);
      res.json(preview);
    } catch (error) {
      handleError(error, res);
    }
  },

  // PMS — appointment view previews (OT cards for all OT tasks in appointment)
  listTaskPreviewsForAppointment: async (req: Request, res: Response) => {
    try {
      const { appointmentId } = req.params;
      const previews =
        await ObservationToolSubmissionService.listTaskPreviewsForAppointment(
          appointmentId,
        );
      res.json(previews);
    } catch (error) {
      handleError(error, res);
    }
  },
};
