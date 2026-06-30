import type { Request, Response } from "express";
import { z } from "zod";
import {
  HospitalizationMonitoringService,
  HospitalizationMonitoringError,
} from "src/services/hospitalization-monitoring.service";
import type { OrgRequest } from "src/middlewares/rbac";

const RecordBodySchema = z.object({
  patientId: z.string().uuid(),
  admissionId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  observedAt: z.string().datetime(),
  temperature: z.number().optional(),
  temperatureUnit: z.enum(["C", "F"]).optional(),
  heartRate: z.number().int().positive().optional(),
  respiratoryRate: z.number().int().positive().optional(),
  spo2: z.number().int().min(0).max(100).optional(),
  bloodPressureSystolic: z.number().int().positive().optional(),
  bloodPressureDiastolic: z.number().int().positive().optional(),
  etco2: z.number().int().positive().optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  crtSecs: z.number().min(0).optional(),
  mucousMembranes: z.string().max(200).optional(),
  inputMl: z.number().min(0).optional(),
  outputMl: z.number().min(0).optional(),
  mentalStatus: z.string().max(200).optional(),
  appetite: z.string().max(200).optional(),
  urination: z.string().max(200).optional(),
  defecation: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  admissionId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const ObsParamsSchema = z.object({
  organisationId: z.string().uuid(),
  obsId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof HospitalizationMonitoringError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const HospitalizationMonitoringController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const { from, to, ...rest } = query.data;
      const records = await HospitalizationMonitoringService.list({
        organisationId: params.data.organisationId,
        ...rest,
        ...(from ? { from: new Date(from) } : {}),
        ...(to ? { to: new Date(to) } : {}),
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list monitoring observations");
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
      const { observedAt, ...rest } = body.data;
      const obs = await HospitalizationMonitoringService.record({
        organisationId: params.data.organisationId,
        observedBy: typedReq.userId ?? undefined,
        ...rest,
        observedAt: new Date(observedAt),
      });
      return res.status(201).json(obs);
    } catch (err) {
      return handleError(err, res, "Failed to record monitoring observation");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ObsParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const obs = await HospitalizationMonitoringService.get(
        params.data.obsId,
        params.data.organisationId,
      );
      return res.status(200).json(obs);
    } catch (err) {
      return handleError(err, res, "Failed to get monitoring observation");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ObsParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await HospitalizationMonitoringService.delete(
        params.data.obsId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete monitoring observation");
    }
  },
};
