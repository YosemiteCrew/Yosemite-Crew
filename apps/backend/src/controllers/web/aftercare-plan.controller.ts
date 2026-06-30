import type { Request, Response } from "express";
import { z } from "zod";
import {
  AftercarePlanService,
  AftercarePlanError,
} from "src/services/aftercare-plan.service";
import type { OrgRequest } from "src/middlewares/rbac";

const AftercareTypeEnum = z.enum([
  "EUTHANASIA_SERVICE",
  "CREMATION_PRIVATE",
  "CREMATION_COMMUNAL",
  "AQUAMATION",
  "BURIAL",
  "HOME_CARE",
  "DONATION_TO_SCIENCE",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  type: AftercareTypeEnum,
  provider: z.string().max(200).optional(),
  estimatedCost: z.number().min(0).optional(),
  depositPaid: z.number().min(0).optional(),
  pawPrintRequested: z.boolean().optional(),
  furClippingRequested: z.boolean().optional(),
  urnsRequested: z.number().int().min(0).optional(),
  instructions: z.string().max(3000).optional(),
  certificateNumber: z.string().max(100).optional(),
  completedAt: z.string().datetime().optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  type: true,
}).partial();

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  type: AftercareTypeEnum.optional(),
  completed: z
    .string()
    .optional()
    .transform((v) =>
      v === "true" ? true : v === "false" ? false : undefined,
    ),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const PlanParamsSchema = z.object({
  organisationId: z.string().uuid(),
  planId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof AftercarePlanError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const AftercarePlanController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await AftercarePlanService.list({
        organisationId: params.data.organisationId,
        patientId: query.data.patientId,
        type: query.data.type,
        completed: query.data.completed,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list aftercare plans");
    }
  },

  create: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = CreateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await AftercarePlanService.create({
        organisationId: params.data.organisationId,
        recordedBy: typedReq.userId ?? undefined,
        ...body.data,
        completedAt: body.data.completedAt
          ? new Date(body.data.completedAt)
          : undefined,
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to create aftercare plan");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await AftercarePlanService.get(
        params.data.planId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get aftercare plan");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await AftercarePlanService.update(
        params.data.planId,
        params.data.organisationId,
        {
          ...body.data,
          completedAt: body.data.completedAt
            ? new Date(body.data.completedAt)
            : undefined,
        },
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update aftercare plan");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await AftercarePlanService.delete(
        params.data.planId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete aftercare plan");
    }
  },
};
