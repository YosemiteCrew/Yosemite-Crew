import { Request, Response } from "express";
import { z } from "zod";
import { BodyConditionRecordService } from "src/services/body-condition-record.service";

const BcsScaleEnum = z.enum(["BCS_5", "BCS_9"]);

const CreateSchema = z.object({
  patientId: z.string(),
  encounterId: z.string().optional(),
  bcsScale: BcsScaleEnum,
  bcsScore: z.number().positive(),
  muscleConditionScore: z.string().optional(),
  weightKg: z.number().positive().optional(),
  bodyFatPercentage: z.number().min(0).max(100).optional(),
  recordedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v)),
  recordedBy: z.string().optional(),
  notes: z.string().optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  bcsScale: BcsScaleEnum.optional(),
});

const TrendQuerySchema = z.object({
  patientId: z.string(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .optional(),
});

export const BodyConditionRecordController = {
  create: async (req: Request, res: Response) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const record = await BodyConditionRecordService.create({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(record);
  },

  get: async (req: Request, res: Response) => {
    const record = await BodyConditionRecordService.get(
      req.params.recordId,
      req.params.organisationId,
    );
    return res.json(record);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const records = await BodyConditionRecordService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(records);
  },

  trend: async (req: Request, res: Response) => {
    const parsed = TrendQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const records = await BodyConditionRecordService.trend(
      parsed.data.patientId,
      req.params.organisationId,
      parsed.data.limit,
    );
    return res.json(records);
  },

  delete: async (req: Request, res: Response) => {
    await BodyConditionRecordService.delete(
      req.params.recordId,
      req.params.organisationId,
    );
    return res.status(204).send();
  },
};
