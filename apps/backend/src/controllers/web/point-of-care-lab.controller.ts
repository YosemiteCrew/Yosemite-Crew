import { Request, Response } from "express";
import { z } from "zod";
import { PointOfCareLabService } from "src/services/point-of-care-lab.service";

const TestTypeEnum = z.enum([
  "CBC",
  "BLOOD_CHEMISTRY",
  "URINALYSIS",
  "FECAL_FLOAT",
  "CYTOLOGY",
  "COAGULATION",
  "ELECTROLYTES",
  "THYROID_PANEL",
  "CORTISOL",
  "GLUCOSE_CURVE",
  "BLOOD_GAS",
  "OTHER",
]);

const CreateSchema = z.object({
  patientId: z.string(),
  encounterId: z.string().optional(),
  conductedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v)),
  conductedBy: z.string().optional(),
  testType: TestTypeEnum,
  analyzerName: z.string().optional(),
  sampleType: z.string().optional(),
  results: z.record(z.unknown()),
  overallInterpretation: z.string().optional(),
  abnormalFlags: z.array(z.string()).optional(),
  criticalFlags: z.array(z.string()).optional(),
  followUpRecommended: z.boolean().optional(),
  notes: z.string().optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  testType: TestTypeEnum.optional(),
  hasCriticalFlags: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

const UpdateSchema = z.object({
  overallInterpretation: z.string().optional(),
  followUpRecommended: z.boolean().optional(),
  notes: z.string().optional(),
});

export const PointOfCareLabController = {
  create: async (req: Request, res: Response) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const record = await PointOfCareLabService.create({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(record);
  },

  get: async (req: Request, res: Response) => {
    const record = await PointOfCareLabService.get(
      req.params.labId,
      req.params.organisationId,
    );
    return res.json(record);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const records = await PointOfCareLabService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(records);
  },

  update: async (req: Request, res: Response) => {
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const record = await PointOfCareLabService.update(
      req.params.labId,
      req.params.organisationId,
      parsed.data,
    );
    return res.json(record);
  },
};
