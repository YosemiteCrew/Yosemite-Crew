import type { Request, Response } from "express";
import { z } from "zod";
import {
  PreventiveCarePlanService,
  PreventiveCarePlanError,
} from "src/services/preventive-care-plan.service";
import type { OrgRequest } from "src/middlewares/rbac";

const FrequencyEnum = z.enum([
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "BIANNUAL",
  "ANNUAL",
  "CUSTOM",
]);
const StatusEnum = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]);

const ItemSchema = z.object({
  careType: z.string().min(1).max(200),
  frequency: FrequencyEnum,
  intervalDays: z.number().int().positive().optional(),
  nextDueAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  items: z.array(ItemSchema).optional(),
});

const UpdatePlanBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: StatusEnum.optional(),
});

const CompleteItemBodySchema = z.object({
  completedAt: z.string().datetime().optional(),
  nextDueAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: StatusEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const PlanParamsSchema = z.object({
  organisationId: z.string().uuid(),
  planId: z.string().uuid(),
});
const ItemParamsSchema = z.object({
  organisationId: z.string().uuid(),
  planId: z.string().uuid(),
  itemId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof PreventiveCarePlanError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const PreventiveCarePlanController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const plans = await PreventiveCarePlanService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(plans);
    } catch (err) {
      return handleError(err, res, "Failed to list care plans");
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
      const { items, ...rest } = body.data;
      const plan = await PreventiveCarePlanService.create({
        organisationId: params.data.organisationId,
        createdBy: typedReq.userId ?? undefined,
        ...rest,
        items: items?.map((i) => ({
          ...i,
          nextDueAt: i.nextDueAt ? new Date(i.nextDueAt) : undefined,
        })),
      });
      return res.status(201).json(plan);
    } catch (err) {
      return handleError(err, res, "Failed to create care plan");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const plan = await PreventiveCarePlanService.get(
        params.data.planId,
        params.data.organisationId,
      );
      return res.status(200).json(plan);
    } catch (err) {
      return handleError(err, res, "Failed to get care plan");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdatePlanBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const plan = await PreventiveCarePlanService.update(
        params.data.planId,
        params.data.organisationId,
        body.data,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(plan);
    } catch (err) {
      return handleError(err, res, "Failed to update care plan");
    }
  },

  addItem: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = ItemSchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { nextDueAt, ...rest } = body.data;
      const item = await PreventiveCarePlanService.addItem(
        params.data.planId,
        params.data.organisationId,
        { ...rest, nextDueAt: nextDueAt ? new Date(nextDueAt) : undefined },
      );
      return res.status(201).json(item);
    } catch (err) {
      return handleError(err, res, "Failed to add care plan item");
    }
  },

  completeItem: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ItemParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = CompleteItemBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { completedAt, nextDueAt, ...rest } = body.data;
      const item = await PreventiveCarePlanService.completeItem(
        params.data.itemId,
        params.data.organisationId,
        {
          ...rest,
          completedAt: completedAt ? new Date(completedAt) : undefined,
          nextDueAt: nextDueAt ? new Date(nextDueAt) : undefined,
        },
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(item);
    } catch (err) {
      return handleError(err, res, "Failed to complete care plan item");
    }
  },
};
