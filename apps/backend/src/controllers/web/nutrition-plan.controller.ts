import type { Request, Response } from "express";
import { z } from "zod";
import {
  NutritionPlanService,
  NutritionPlanError,
} from "src/services/nutrition-plan.service";
import type { OrgRequest } from "src/middlewares/rbac";

const StatusEnum = z.enum(["ACTIVE", "COMPLETED", "DISCONTINUED"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  dietName: z.string().min(1).max(300),
  calories: z.number().positive().optional(),
  calorieUnit: z.string().max(50).optional(),
  protein: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  fibre: z.number().min(0).optional(),
  feedingFrequency: z.string().max(200).optional(),
  portionSize: z.string().max(200).optional(),
  waterIntake: z.string().max(200).optional(),
  restrictions: z.string().max(2000).optional(),
  indication: z.string().max(1000).optional(),
  reviewDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  dietName: z.string().min(1).max(300).optional(),
  calories: z.number().positive().optional(),
  calorieUnit: z.string().max(50).optional(),
  protein: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  fibre: z.number().min(0).optional(),
  feedingFrequency: z.string().max(200).optional(),
  portionSize: z.string().max(200).optional(),
  waterIntake: z.string().max(200).optional(),
  restrictions: z.string().max(2000).optional(),
  indication: z.string().max(1000).optional(),
  reviewDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  status: StatusEnum.optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  status: StatusEnum.optional(),
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
  if (err instanceof NutritionPlanError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const NutritionPlanController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await NutritionPlanService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list nutrition plans");
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
      const { reviewDate, ...rest } = body.data;
      const record = await NutritionPlanService.create({
        organisationId: params.data.organisationId,
        prescribedBy: typedReq.userId ?? undefined,
        ...rest,
        ...(reviewDate ? { reviewDate: new Date(reviewDate) } : {}),
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to create nutrition plan");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await NutritionPlanService.get(
        params.data.planId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get nutrition plan");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { reviewDate, ...rest } = body.data;
      const record = await NutritionPlanService.update(
        params.data.planId,
        params.data.organisationId,
        {
          ...rest,
          ...(reviewDate ? { reviewDate: new Date(reviewDate) } : {}),
        },
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update nutrition plan");
    }
  },
};
