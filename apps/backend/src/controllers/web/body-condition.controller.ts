import type { Request, Response } from "express";
import { z } from "zod";
import {
  BodyConditionService,
  BodyConditionError,
} from "src/services/body-condition.service";
import type { OrgRequest } from "src/middlewares/rbac";

const BcsScaleEnum = z.enum(["BCS_5", "BCS_9"]);

const RecordBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  bcsScale: BcsScaleEnum,
  bcsScore: z.number().min(1).max(9),
  muscleConditionScore: z.string().max(200).optional(),
  weightKg: z.number().min(0).max(1000).optional(),
  bodyFatPercentage: z.number().min(0).max(100).optional(),
  recordedAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  bcsScale: BcsScaleEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const TrendQuerySchema = z.object({
  patientId: z.string().uuid(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const RecordParamsSchema = z.object({
  organisationId: z.string().uuid(),
  recordId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof BodyConditionError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const BodyConditionController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const { from, to, ...rest } = query.data;
      const records = await BodyConditionService.list({
        organisationId: params.data.organisationId,
        ...rest,
        ...(from ? { from: new Date(from) } : {}),
        ...(to ? { to: new Date(to) } : {}),
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list body condition records");
    }
  },

  record: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = RecordBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { recordedAt, ...rest } = body.data;
      const bcr = await BodyConditionService.record({
        organisationId: params.data.organisationId,
        recordedBy: typedReq.userId ?? undefined,
        ...rest,
        recordedAt: new Date(recordedAt),
      });
      return res.status(201).json(bcr);
    } catch (err) {
      return handleError(err, res, "Failed to record body condition");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = RecordParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const bcr = await BodyConditionService.get(
        params.data.recordId,
        params.data.organisationId,
      );
      return res.status(200).json(bcr);
    } catch (err) {
      return handleError(err, res, "Failed to get body condition record");
    }
  },

  trend: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = TrendQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await BodyConditionService.trend(
        query.data.patientId,
        params.data.organisationId,
        query.data.limit,
      );
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to get body condition trend");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = RecordParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await BodyConditionService.delete(
        params.data.recordId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete body condition record");
    }
  },
};
