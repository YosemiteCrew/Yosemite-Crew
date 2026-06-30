import type { Request, Response } from "express";
import { z } from "zod";
import {
  SurgicalProcedureService,
  SurgicalProcedureError,
} from "src/services/surgical-procedure.service";
import type { OrgRequest } from "src/middlewares/rbac";

const OutcomeEnum = z.enum(["SUCCESS", "COMPLICATION", "ABANDONED", "PENDING"]);
const AnesthesiaEnum = z.enum([
  "GENERAL",
  "LOCAL",
  "SEDATION",
  "EPIDURAL",
  "NONE",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  procedureName: z.string().min(1).max(300),
  surgeon: z.string().max(200).optional(),
  assistants: z.array(z.string().max(200)).optional(),
  anesthesiaType: AnesthesiaEnum.optional(),
  anesthesiaAgent: z.string().max(200).optional(),
  anesthesiaDoseMs: z.number().positive().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  outcome: OutcomeEnum.optional(),
  complications: z.string().max(2000).optional(),
  instruments: z.array(z.string().max(200)).optional(),
  specimensSent: z.array(z.string().max(200)).optional(),
  postOpNotes: z.string().max(5000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  encounterId: true,
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  outcome: OutcomeEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const ProcedureParamsSchema = z.object({
  organisationId: z.string().uuid(),
  procedureId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof SurgicalProcedureError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

const parseDates = (data: Record<string, unknown>) => {
  const out = { ...data };
  if (typeof out.startedAt === "string")
    out.startedAt = new Date(out.startedAt as string);
  if (typeof out.endedAt === "string")
    out.endedAt = new Date(out.endedAt as string);
  return out;
};

export const SurgicalProcedureController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await SurgicalProcedureService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list surgical procedures");
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
      const record = await SurgicalProcedureService.create({
        organisationId: params.data.organisationId,
        performedBy: typedReq.userId ?? undefined,
        ...parseDates(body.data as Record<string, unknown>),
      } as Parameters<typeof SurgicalProcedureService.create>[0]);
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to record surgical procedure");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ProcedureParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await SurgicalProcedureService.get(
        params.data.procedureId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get surgical procedure");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ProcedureParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await SurgicalProcedureService.update(
        params.data.procedureId,
        params.data.organisationId,
        parseDates(body.data as Record<string, unknown>) as Parameters<
          typeof SurgicalProcedureService.update
        >[2],
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update surgical procedure");
    }
  },
};
