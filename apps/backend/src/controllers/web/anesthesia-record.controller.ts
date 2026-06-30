import type { Request, Response } from "express";
import { z } from "zod";
import {
  AnesthesiaRecordService,
  AnesthesiaRecordError,
} from "src/services/anesthesia-record.service";
import type { OrgRequest } from "src/middlewares/rbac";

const AnesthesiaTypeEnum = z.enum([
  "GENERAL",
  "LOCAL",
  "SEDATION",
  "EPIDURAL",
  "REGIONAL",
  "TOTAL_IV",
  "NONE",
]);
const StatusEnum = z.enum(["IN_PROGRESS", "COMPLETED", "ABORTED"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  surgicalProcedureId: z.string().uuid().optional(),
  anesthesiaType: AnesthesiaTypeEnum.optional(),
  anesthesiologist: z.string().max(300).optional(),
  assistantName: z.string().max(300).optional(),
  preMedication: z.string().max(2000).optional(),
  inductionAgent: z.string().max(2000).optional(),
  maintenanceAgent: z.string().max(2000).optional(),
  oxygenFlowLpm: z.number().positive().optional(),
  inductionTime: z.string().datetime().optional(),
  intubationTime: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  anesthesiaType: AnesthesiaTypeEnum.optional(),
  anesthesiologist: z.string().max(300).optional(),
  assistantName: z.string().max(300).optional(),
  preMedication: z.string().max(2000).optional(),
  inductionAgent: z.string().max(2000).optional(),
  maintenanceAgent: z.string().max(2000).optional(),
  oxygenFlowLpm: z.number().positive().optional(),
  inductionTime: z.string().datetime().optional(),
  intubationTime: z.string().datetime().optional(),
  recoveryStartTime: z.string().datetime().optional(),
  recoveryEndTime: z.string().datetime().optional(),
  complications: z.string().max(3000).optional(),
  recoveryNotes: z.string().max(3000).optional(),
  status: StatusEnum.optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  surgicalProcedureId: z.string().uuid().optional(),
  status: StatusEnum.optional(),
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
  if (err instanceof AnesthesiaRecordError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

const parseDateFields = (obj: Record<string, unknown>, keys: string[]) => {
  const out = { ...obj };
  for (const k of keys) {
    if (typeof out[k] === "string") out[k] = new Date(out[k] as string);
  }
  return out;
};

export const AnesthesiaRecordController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await AnesthesiaRecordService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list anesthesia records");
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
      const d = body.data;
      const record = await AnesthesiaRecordService.create({
        organisationId: params.data.organisationId,
        patientId: d.patientId,
        encounterId: d.encounterId,
        surgicalProcedureId: d.surgicalProcedureId,
        anesthesiaType: d.anesthesiaType,
        anesthesiologist: typedReq.userId ?? undefined,
        assistantName: d.assistantName,
        preMedication: d.preMedication,
        inductionAgent: d.inductionAgent,
        maintenanceAgent: d.maintenanceAgent,
        oxygenFlowLpm: d.oxygenFlowLpm,
        inductionTime: d.inductionTime ? new Date(d.inductionTime) : undefined,
        intubationTime: d.intubationTime
          ? new Date(d.intubationTime)
          : undefined,
        notes: d.notes,
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to create anesthesia record");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = RecordParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await AnesthesiaRecordService.get(
        params.data.recordId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get anesthesia record");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = RecordParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const parsed = parseDateFields(body.data as Record<string, unknown>, [
        "inductionTime",
        "intubationTime",
        "recoveryStartTime",
        "recoveryEndTime",
      ]);
      const record = await AnesthesiaRecordService.update(
        params.data.recordId,
        params.data.organisationId,
        parsed as Parameters<typeof AnesthesiaRecordService.update>[2],
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update anesthesia record");
    }
  },
};
