import type { Request, Response } from "express";
import { z } from "zod";
import {
  EmergencyTriageService,
  EmergencyTriageError,
} from "src/services/emergency-triage.service";
import type { OrgRequest } from "src/middlewares/rbac";

const TriagePriorityEnum = z.enum([
  "IMMEDIATE",
  "URGENT",
  "LESS_URGENT",
  "STANDARD",
  "NON_URGENT",
]);

const RecordBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  triagePriority: TriagePriorityEnum,
  chiefComplaint: z.string().min(1).max(1000),
  presentationAt: z.string().datetime(),
  heartRate: z.number().int().min(0).max(500).optional(),
  respiratoryRate: z.number().int().min(0).max(200).optional(),
  temperature: z.number().min(25).max(45).optional(),
  bloodPressureSystolic: z.number().int().min(0).max(400).optional(),
  bloodPressureDiastolic: z.number().int().min(0).max(300).optional(),
  oxygenSaturation: z.number().min(0).max(100).optional(),
  capillaryRefillTime: z.number().min(0).max(20).optional(),
  mentalStatus: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

const EscalateBodySchema = z.object({
  escalatedReason: z.string().min(1).max(2000),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const TriageParamsSchema = z.object({
  organisationId: z.string().uuid(),
  triageId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof EmergencyTriageError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const EmergencyTriageController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const { from, to, ...rest } = query.data;
      const records = await EmergencyTriageService.list({
        organisationId: params.data.organisationId,
        ...rest,
        ...(from ? { from: new Date(from) } : {}),
        ...(to ? { to: new Date(to) } : {}),
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list triage records");
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
      const { presentationAt, ...rest } = body.data;
      const triage = await EmergencyTriageService.record({
        organisationId: params.data.organisationId,
        triageBy: typedReq.userId ?? undefined,
        ...rest,
        presentationAt: new Date(presentationAt),
      });
      return res.status(201).json(triage);
    } catch (err) {
      return handleError(err, res, "Failed to record triage");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = TriageParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const triage = await EmergencyTriageService.get(
        params.data.triageId,
        params.data.organisationId,
      );
      return res.status(200).json(triage);
    } catch (err) {
      return handleError(err, res, "Failed to get triage record");
    }
  },

  escalate: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = TriageParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = EscalateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const triage = await EmergencyTriageService.escalate(
        params.data.triageId,
        params.data.organisationId,
        body.data,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(triage);
    } catch (err) {
      return handleError(err, res, "Failed to escalate triage");
    }
  },
};
