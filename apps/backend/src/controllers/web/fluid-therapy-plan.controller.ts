import type { Request, Response } from "express";
import { z } from "zod";
import {
  FluidTherapyPlanService,
  FluidTherapyPlanError,
} from "src/services/fluid-therapy-plan.service";
import type { OrgRequest } from "src/middlewares/rbac";

const FluidTypeEnum = z.enum([
  "SALINE_09",
  "LACTATED_RINGERS",
  "DEXTROSE_5",
  "HARTMANNS",
  "PLASMALYTE",
  "COLLOID",
  "BLOOD_PRODUCT",
  "CUSTOM",
]);
const StatusEnum = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "DISCONTINUED"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  admissionId: z.string().uuid().optional(),
  fluidType: FluidTypeEnum,
  customFluidName: z.string().max(200).optional(),
  additives: z.string().max(500).optional(),
  rateMlPerHour: z.number().positive(),
  totalVolumeMl: z.number().positive().optional(),
  durationHours: z.number().positive().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  indication: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  fluidType: FluidTypeEnum.optional(),
  customFluidName: z.string().max(200).optional(),
  additives: z.string().max(500).optional(),
  rateMlPerHour: z.number().positive().optional(),
  totalVolumeMl: z.number().positive().optional(),
  durationHours: z.number().positive().optional(),
  endedAt: z.string().datetime().optional(),
  status: StatusEnum.optional(),
  indication: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  admissionId: z.string().uuid().optional(),
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
  if (err instanceof FluidTherapyPlanError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const FluidTherapyPlanController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await FluidTherapyPlanService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list fluid therapy plans");
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
      const { startedAt, endedAt, ...rest } = body.data;
      const record = await FluidTherapyPlanService.create({
        organisationId: params.data.organisationId,
        prescribedBy: typedReq.userId ?? undefined,
        ...rest,
        startedAt: new Date(startedAt),
        ...(endedAt ? { endedAt: new Date(endedAt) } : {}),
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to create fluid therapy plan");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await FluidTherapyPlanService.get(
        params.data.planId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get fluid therapy plan");
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
      const { endedAt, ...rest } = body.data;
      const record = await FluidTherapyPlanService.update(
        params.data.planId,
        params.data.organisationId,
        {
          ...rest,
          ...(endedAt ? { endedAt: new Date(endedAt) } : {}),
        },
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update fluid therapy plan");
    }
  },
};
