import { Request, Response } from "express";
import { z } from "zod";
import { QualityOfLifeAssessmentService } from "src/services/quality-of-life-assessment.service";

const score = z.number().int().min(0).max(10);

const CreateSchema = z.object({
  patientId: z.string(),
  encounterId: z.string().optional(),
  assessedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v)),
  assessedBy: z.string().optional(),
  hhhhhmmScore: score.optional(),
  painScore: score.optional(),
  appetiteScore: score.optional(),
  hygieneScore: score.optional(),
  happinessScore: score.optional(),
  mobilityScore: score.optional(),
  moreDaysGood: z.boolean().optional(),
  overallScore: score.optional(),
  ownerAssessed: z.boolean().optional(),
  clinicianNotes: z.string().optional(),
  ownerNotes: z.string().optional(),
  euthanasiaDiscussed: z.boolean().optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
});

const TrendQuerySchema = z.object({
  patientId: z.string(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .optional(),
});

export const QualityOfLifeAssessmentController = {
  create: async (req: Request, res: Response) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const assessment = await QualityOfLifeAssessmentService.create({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(assessment);
  },

  get: async (req: Request, res: Response) => {
    const assessment = await QualityOfLifeAssessmentService.get(
      req.params.assessmentId,
      req.params.organisationId,
    );
    return res.json(assessment);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const assessments = await QualityOfLifeAssessmentService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(assessments);
  },

  trend: async (req: Request, res: Response) => {
    const parsed = TrendQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const records = await QualityOfLifeAssessmentService.trend(
      parsed.data.patientId,
      req.params.organisationId,
      parsed.data.limit,
    );
    return res.json(records);
  },

  update: async (req: Request, res: Response) => {
    const parsed = CreateSchema.partial()
      .omit({ patientId: true })
      .safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const assessment = await QualityOfLifeAssessmentService.update(
      req.params.assessmentId,
      req.params.organisationId,
      parsed.data,
    );
    return res.json(assessment);
  },
};
