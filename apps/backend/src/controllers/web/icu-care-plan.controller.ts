import type { Request, Response } from "express";
import { z } from "zod";
import {
  IcuCarePlanService,
  IcuCarePlanError,
} from "src/services/icu-care-plan.service";
import type { OrgRequest } from "src/middlewares/rbac";

const IcuStatusEnum = z.enum([
  "ACTIVE",
  "TRANSFERRED",
  "DISCHARGED",
  "DECEASED",
]);
const DischargeStatusEnum = z.enum(["TRANSFERRED", "DISCHARGED", "DECEASED"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  admittedAt: z.string().datetime(),
  onVentilator: z.boolean().optional(),
  onOxygenSupport: z.boolean().optional(),
  hasUrinaryCatheter: z.boolean().optional(),
  hasCentralLine: z.boolean().optional(),
  hasDrain: z.boolean().optional(),
  devices: z.string().max(1000).optional(),
  dailyGoals: z.string().max(3000).optional(),
  nursingFrequency: z.string().max(1000).optional(),
  alertThresholds: z.string().max(2000).optional(),
  primaryVet: z.string().max(300).optional(),
  nursePrimary: z.string().max(300).optional(),
  anticipatedDischarge: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  onVentilator: z.boolean().optional(),
  onOxygenSupport: z.boolean().optional(),
  hasUrinaryCatheter: z.boolean().optional(),
  hasCentralLine: z.boolean().optional(),
  hasDrain: z.boolean().optional(),
  devices: z.string().max(1000).optional(),
  dailyGoals: z.string().max(3000).optional(),
  nursingFrequency: z.string().max(1000).optional(),
  alertThresholds: z.string().max(2000).optional(),
  primaryVet: z.string().max(300).optional(),
  nursePrimary: z.string().max(300).optional(),
  anticipatedDischarge: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const DischargeBodySchema = z.object({
  status: DischargeStatusEnum,
  dischargeSummary: z.string().max(5000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  status: IcuStatusEnum.optional(),
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
  if (err instanceof IcuCarePlanError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const IcuCarePlanController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const plans = await IcuCarePlanService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(plans);
    } catch (err) {
      return handleError(err, res, "Failed to list ICU care plans");
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
      const { admittedAt, anticipatedDischarge, ...rest } = body.data;
      const plan = await IcuCarePlanService.create({
        organisationId: params.data.organisationId,
        primaryVet: rest.primaryVet ?? typedReq.userId ?? undefined,
        ...rest,
        admittedAt: new Date(admittedAt),
        ...(anticipatedDischarge
          ? { anticipatedDischarge: new Date(anticipatedDischarge) }
          : {}),
      });
      return res.status(201).json(plan);
    } catch (err) {
      return handleError(err, res, "Failed to create ICU care plan");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const plan = await IcuCarePlanService.get(
        params.data.planId,
        params.data.organisationId,
      );
      return res.status(200).json(plan);
    } catch (err) {
      return handleError(err, res, "Failed to get ICU care plan");
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
      const { anticipatedDischarge, ...rest } = body.data;
      const plan = await IcuCarePlanService.update(
        params.data.planId,
        params.data.organisationId,
        {
          ...rest,
          ...(anticipatedDischarge
            ? { anticipatedDischarge: new Date(anticipatedDischarge) }
            : {}),
        },
      );
      return res.status(200).json(plan);
    } catch (err) {
      return handleError(err, res, "Failed to update ICU care plan");
    }
  },

  discharge: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = DischargeBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const plan = await IcuCarePlanService.discharge(
        params.data.planId,
        params.data.organisationId,
        body.data,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(plan);
    } catch (err) {
      return handleError(err, res, "Failed to discharge ICU care plan");
    }
  },
};
