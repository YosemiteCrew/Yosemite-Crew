import type { Request, Response } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import type { OrgRequest } from "src/middlewares/rbac";
import {
  SavedReportService,
  SavedReportServiceError,
} from "src/services/saved-report.service";
import logger from "src/utils/logger";

const parametersSchema = z.record(z.string(), z.unknown());
const viewCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  reportType: z.string().trim().min(1),
  parameters: parametersSchema.default({}),
});
const viewUpdateSchema = viewCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);
const scheduleCreateSchema = z.object({
  viewId: z.uuid(),
  recipients: z.array(z.string().trim().min(1)).min(1).max(100),
  cronExpression: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(100),
  active: z.boolean().optional(),
});
const scheduleUpdateSchema = scheduleCreateSchema
  .omit({ viewId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);

const handleError = (res: Response, error: unknown) => {
  if (error instanceof z.ZodError) {
    return res
      .status(400)
      .json({ message: "Invalid report settings", issues: error.issues });
  }
  if (error instanceof SavedReportServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error("Unable to manage saved reports", error);
  return res.status(500).json({ message: "Internal Server Error" });
};

export const SavedReportController = {
  listViews: async (req: Request, res: Response) => {
    try {
      return res.json(
        await SavedReportService.listViews(req.params.organisationId),
      );
    } catch (error) {
      return handleError(res, error);
    }
  },
  createView: async (req: Request, res: Response) => {
    try {
      const body = viewCreateSchema.parse(req.body);
      const createdBy = (req as OrgRequest).userId;
      if (!createdBy)
        throw new SavedReportServiceError(
          "Authenticated user is required",
          401,
        );
      const view = await SavedReportService.createView({
        organisationId: req.params.organisationId,
        createdBy,
        ...body,
        parameters: body.parameters as Prisma.InputJsonValue,
      });
      return res.status(201).json(view);
    } catch (error) {
      return handleError(res, error);
    }
  },
  updateView: async (req: Request, res: Response) => {
    try {
      const body = viewUpdateSchema.parse(req.body);
      return res.json(
        await SavedReportService.updateView({
          organisationId: req.params.organisationId,
          viewId: req.params.viewId,
          ...body,
          parameters: body.parameters as Prisma.InputJsonValue | undefined,
        }),
      );
    } catch (error) {
      return handleError(res, error);
    }
  },
  deleteView: async (req: Request, res: Response) => {
    try {
      await SavedReportService.deleteView(
        req.params.organisationId,
        req.params.viewId,
      );
      return res.status(204).send();
    } catch (error) {
      return handleError(res, error);
    }
  },
  listSchedules: async (req: Request, res: Response) => {
    try {
      return res.json(
        await SavedReportService.listSchedules(req.params.organisationId),
      );
    } catch (error) {
      return handleError(res, error);
    }
  },
  createSchedule: async (req: Request, res: Response) => {
    try {
      const body = scheduleCreateSchema.parse(req.body);
      return res.status(201).json(
        await SavedReportService.createSchedule({
          organisationId: req.params.organisationId,
          ...body,
        }),
      );
    } catch (error) {
      return handleError(res, error);
    }
  },
  updateSchedule: async (req: Request, res: Response) => {
    try {
      const body = scheduleUpdateSchema.parse(req.body);
      return res.json(
        await SavedReportService.updateSchedule({
          organisationId: req.params.organisationId,
          scheduleId: req.params.scheduleId,
          ...body,
        }),
      );
    } catch (error) {
      return handleError(res, error);
    }
  },
  deleteSchedule: async (req: Request, res: Response) => {
    try {
      await SavedReportService.deleteSchedule(
        req.params.organisationId,
        req.params.scheduleId,
      );
      return res.status(204).send();
    } catch (error) {
      return handleError(res, error);
    }
  },
};
