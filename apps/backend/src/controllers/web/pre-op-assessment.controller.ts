import { Request, Response } from "express";
import { z } from "zod";
import { PreOpAssessmentService } from "src/services/pre-op-assessment.service";

const AsaClassEnum = z.enum([
  "ASA_I",
  "ASA_II",
  "ASA_III",
  "ASA_IV",
  "ASA_V",
  "ASA_E",
]);

const CreatePreOpSchema = z.object({
  patientId: z.string(),
  encounterId: z.string(),
  asaClass: AsaClassEnum.optional(),
  fastingStartedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
  labsReviewed: z.boolean().optional(),
  ecgReviewed: z.boolean().optional(),
  ownerConsentSigned: z.boolean().optional(),
  anesthetistId: z.string().optional(),
  surgeonId: z.string().optional(),
  plannedProcedure: z.string().optional(),
  anesthesiaType: z.string().optional(),
  knownAllergies: z.string().optional(),
  currentMedications: z.string().optional(),
  airwayNotes: z.string().optional(),
  cardiovascularNotes: z.string().optional(),
  notes: z.string().optional(),
  assessedBy: z.string().optional(),
  assessedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
});

const UpdatePreOpSchema = CreatePreOpSchema.omit({
  patientId: true,
  encounterId: true,
}).partial();

const ListQuerySchema = z.object({
  patientId: z.string().optional(),
  encounterId: z.string().optional(),
  asaClass: AsaClassEnum.optional(),
});

export const PreOpAssessmentController = {
  create: async (req: Request, res: Response) => {
    const parsed = CreatePreOpSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const assessment = await PreOpAssessmentService.create({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.status(201).json(assessment);
  },

  get: async (req: Request, res: Response) => {
    const assessment = await PreOpAssessmentService.get(
      req.params.assessmentId,
      req.params.organisationId,
    );
    return res.json(assessment);
  },

  list: async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const results = await PreOpAssessmentService.list({
      organisationId: req.params.organisationId,
      ...parsed.data,
    });
    return res.json(results);
  },

  update: async (req: Request, res: Response) => {
    const parsed = UpdatePreOpSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.errors });

    const assessment = await PreOpAssessmentService.update(
      req.params.assessmentId,
      req.params.organisationId,
      parsed.data,
    );
    return res.json(assessment);
  },

  delete: async (req: Request, res: Response) => {
    await PreOpAssessmentService.delete(
      req.params.assessmentId,
      req.params.organisationId,
    );
    return res.status(204).send();
  },
};
