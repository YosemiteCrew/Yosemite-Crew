import { Request, Response } from "express";
import { z } from "zod";
import { AnaesthesiaRecordService } from "src/services/anaesthesia-record.service";

const StatusEnum = z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "ABORTED"]);

const PlanSchema = z.object({
  patientId: z.string(),
  appointmentId: z.string().optional(),
  surgicalProcedureId: z.string().optional(),
  anaesthetistId: z.string().optional(),
  inductionAgent: z.string().optional(),
  maintenanceAgent: z.string().optional(),
  oxygenFlowLpm: z.number().positive().optional(),
  preOpAssessment: z.string().optional(),
  preMedications: z.record(z.unknown()).optional(),
});

const CompleteSchema = z.object({
  complications: z.string().optional(),
  recoveryNotes: z.string().optional(),
});

const AbortSchema = z.object({
  complications: z.string().optional(),
});

const IntraOpNotesSchema = z.object({
  notes: z.record(z.unknown()),
});

const ListQuerySchema = z.object({
  patientId: z.string().optional(),
  appointmentId: z.string().optional(),
  status: StatusEnum.optional(),
});

export const AnaesthesiaRecordController = {
  plan: async (req: Request, res: Response) => {
    const parsed = PlanSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const result = await AnaesthesiaRecordService.plan({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(result);
  },

  get: async (req: Request, res: Response) => {
    const result = await AnaesthesiaRecordService.get(
      req.params.recordId,
      req.params.organisationId,
    );
    return res.json(result);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const results = await AnaesthesiaRecordService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(results);
  },

  start: async (req: Request, res: Response) => {
    const result = await AnaesthesiaRecordService.start(
      req.params.recordId,
      req.params.organisationId,
    );
    return res.json(result);
  },

  updateIntraOpNotes: async (req: Request, res: Response) => {
    const parsed = IntraOpNotesSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const result = await AnaesthesiaRecordService.updateIntraOpNotes(
      req.params.recordId,
      req.params.organisationId,
      parsed.data.notes,
    );
    return res.json(result);
  },

  complete: async (req: Request, res: Response) => {
    const parsed = CompleteSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const result = await AnaesthesiaRecordService.complete(
      req.params.recordId,
      req.params.organisationId,
      parsed.data,
    );
    return res.json(result);
  },

  abort: async (req: Request, res: Response) => {
    const parsed = AbortSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const result = await AnaesthesiaRecordService.abort(
      req.params.recordId,
      req.params.organisationId,
      parsed.data.complications,
    );
    return res.json(result);
  },
};
