import { Request, Response } from "express";
import { AuthenticatedRequest } from "src/middlewares/auth";
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

const resolveUserId = (req: Request): string | undefined => {
  const authReq = req as AuthenticatedRequest;
  const headerUser = req.headers["x-user-id"];
  if (headerUser && typeof headerUser === "string") return headerUser;
  return authReq.userId;
};

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

      const { companionId, taskId, answers, summary } = req.body as {
        companionId: string;
        taskId?: string;
        answers: CreateObservationToolSubmissionInput["answers"];
        summary?: string;
      };

      if (!companionId) {
        return res.status(400).json({ message: "companionId is required" });
      }
      if (!answers || typeof answers !== "object") {
        return res.status(400).json({ message: "answers are required" });
      }

      const submission =
        await ObservationToolSubmissionService.createSubmission({
          toolId,
          taskId,
          companionId,
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
      const { companionId } = req.query as { companionId?: string };
      const toolId = req.query.toolId as string | undefined;
      const fromDate = req.query.fromDate
        ? new Date(req.query.fromDate as string)
        : undefined;
      const toDate = req.query.toDate
        ? new Date(req.query.toDate as string)
        : undefined;

      const submissions =
        await ObservationToolSubmissionService.listSubmissions({
          companionId: companionId || undefined,
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
      const submission = await ObservationToolSubmissionService.getById(
        req.params.submissionId,
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
    const { appointmentId, enforceSingle } = req.body as {
      appointmentId: string;
      enforceSingle?: boolean;
    };

    const updated = await ObservationToolSubmissionService.linkToAppointment({
      submissionId,
      appointmentId,
      enforceSingleSubmissionPerAppointment: enforceSingle === true,
    });

    res.json(updated);
  } catch (error) {
    handleError(error, res);
  }
},

  // PMS — list submissions attached to one appointment
  listForAppointment: async (req: Request, res: Response) => {
    try {
      const { appointmentId } = req.params;
      const submissions =
        await ObservationToolSubmissionService.listForAppointment(
          appointmentId,
        );
      res.json(submissions);
    } catch (error) {
      handleError(error, res);
    }
  },
};
