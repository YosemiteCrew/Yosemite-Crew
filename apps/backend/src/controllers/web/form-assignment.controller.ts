import { Request, Response } from "express";
import { z } from "zod";
import {
  FormAssignmentService,
  FormAssignmentServiceError,
  createFormAssignmentSchema,
  formAssignmentSignerIdentitySchema,
} from "src/services/form-assignment.service";
import logger from "src/utils/logger";
import type { AuthenticatedRequest } from "src/middlewares/auth";

const appointmentParamsSchema = z.object({
  organisationId: z.string().min(1),
  appointmentId: z.string().min(1),
});

const companionParamsSchema = z.object({
  organisationId: z.string().min(1),
  companionId: z.string().min(1),
});

const assignmentParamsSchema = z.object({
  organisationId: z.string().min(1),
  assignmentId: z.string().min(1),
});

const createBodySchema = createFormAssignmentSchema
  .omit({
    organisationId: true,
    createdBy: true,
    appointmentId: true,
  })
  .extend({
    signerIdentity: formAssignmentSignerIdentitySchema.optional(),
  });

const handleError = (error: unknown, res: Response) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid form assignment request.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (error instanceof FormAssignmentServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error("Unexpected form assignment error", error);
  return res.status(500).json({ message: "Internal Server Error" });
};

const resolveUserId = (req: Request) => {
  const typed = req as AuthenticatedRequest;
  return typeof typed.userId === "string" ? typed.userId : "";
};

export const FormAssignmentController = {
  async createForAppointment(req: Request, res: Response) {
    try {
      const params = appointmentParamsSchema.parse(req.params);
      const userId = resolveUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const body = createBodySchema.parse(req.body ?? {});
      const assignment = await FormAssignmentService.createForAppointment({
        ...body,
        organisationId: params.organisationId,
        appointmentId: params.appointmentId,
        createdBy: userId,
      });
      return res.status(201).json(assignment);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listForAppointment(req: Request, res: Response) {
    try {
      const params = appointmentParamsSchema.parse(req.params);
      const assignments = await FormAssignmentService.listForAppointment(
        params.organisationId,
        params.appointmentId,
      );
      return res.status(200).json(assignments);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listForCompanion(req: Request, res: Response) {
    try {
      const params = companionParamsSchema.parse(req.params);
      const assignments = await FormAssignmentService.listForCompanion(
        params.organisationId,
        params.companionId,
      );
      return res.status(200).json(assignments);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async resend(req: Request, res: Response) {
    try {
      const params = assignmentParamsSchema.parse(req.params);
      const userId = resolveUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const assignment = await FormAssignmentService.resend(
        params.assignmentId,
        params.organisationId,
        userId,
      );
      return res.status(200).json(assignment);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async cancel(req: Request, res: Response) {
    try {
      const params = assignmentParamsSchema.parse(req.params);
      const userId = resolveUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const assignment = await FormAssignmentService.cancel(
        params.assignmentId,
        params.organisationId,
        userId,
      );
      return res.status(200).json(assignment);
    } catch (error) {
      return handleError(error, res);
    }
  },
};
