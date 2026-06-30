import type { Request, Response } from "express";
import { z } from "zod";
import {
  VitalSignService,
  VitalSignError,
} from "src/services/vital-sign.service";
import type { OrgRequest } from "src/middlewares/rbac";

const RecordBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  recordedAt: z.string().datetime().optional(),
  weightKg: z.number().positive().optional(),
  temperatureCelsius: z.number().optional(),
  pulseRateBpm: z.number().int().positive().optional(),
  respiratoryRateBpm: z.number().int().positive().optional(),
  systolicBp: z.number().int().positive().optional(),
  diastolicBp: z.number().int().positive().optional(),
  bodyConditionScore: z.number().int().min(1).max(9).optional(),
  mucosal: z.string().max(100).optional(),
  capRefillTimeSec: z.number().positive().optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = RecordBodySchema.omit({
  patientId: true,
  encounterId: true,
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const EntryParamsSchema = z.object({
  organisationId: z.string().uuid(),
  vitalSignId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof VitalSignError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const VitalSignController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const { from, to, ...rest } = query.data;
      const entries = await VitalSignService.list({
        organisationId: params.data.organisationId,
        ...(from ? { from: new Date(from) } : {}),
        ...(to ? { to: new Date(to) } : {}),
        ...rest,
      });
      return res.status(200).json(entries);
    } catch (err) {
      return handleError(err, res, "Failed to list vital signs");
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
      const entry = await VitalSignService.record({
        organisationId: params.data.organisationId,
        recordedBy: typedReq.userId ?? undefined,
        ...(recordedAt ? { recordedAt: new Date(recordedAt) } : {}),
        ...rest,
      });
      return res.status(201).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to record vital signs");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = EntryParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const entry = await VitalSignService.get(
        params.data.vitalSignId,
        params.data.organisationId,
      );
      return res.status(200).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to get vital sign");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = EntryParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const entry = await VitalSignService.update(
        params.data.vitalSignId,
        params.data.organisationId,
        body.data,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(entry);
    } catch (err) {
      return handleError(err, res, "Failed to update vital sign");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = EntryParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await VitalSignService.delete(
        params.data.vitalSignId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete vital sign");
    }
  },
};
