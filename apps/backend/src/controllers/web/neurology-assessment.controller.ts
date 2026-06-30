import type { Request, Response } from "express";
import { z } from "zod";
import {
  NeurologyAssessmentService,
  NeurologyAssessmentError,
} from "src/services/neurology-assessment.service";
import type { OrgRequest } from "src/middlewares/rbac";

const ConsciousnessLevelEnum = z.enum(["ALERT", "OBTUNDED", "STUPOR", "COMA"]);
const GaitScoreEnum = z.enum([
  "NORMAL",
  "PARETIC",
  "ATAXIC",
  "NON_AMBULATORY_PARAPLEGIC",
  "NON_AMBULATORY_TETRAPLEGIC",
]);
const SpinalReflexGradeEnum = z.enum([
  "ABSENT",
  "REDUCED",
  "NORMAL",
  "EXAGGERATED",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  consciousnessLevel: ConsciousnessLevelEnum.optional(),
  gaitScore: GaitScoreEnum.optional(),
  cranialNerveFindings: z.string().max(3000).optional(),
  spinalReflexGrades: z.record(SpinalReflexGradeEnum).optional(),
  deepPainPresent: z.boolean().optional(),
  proprioceptionIntact: z.boolean().optional(),
  seizureHistory: z.boolean().optional(),
  seizureFrequency: z.string().max(300).optional(),
  mriRecommended: z.boolean().optional(),
  diagnoses: z.array(z.string().max(300)).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  assessedAt: true,
}).partial();
const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  gaitScore: GaitScoreEnum.optional(),
});
const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const AssessmentParamsSchema = z.object({
  organisationId: z.string().uuid(),
  assessmentId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof NeurologyAssessmentError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const NeurologyAssessmentController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const assessments = await NeurologyAssessmentService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(assessments);
    } catch (err) {
      return handleError(err, res, "Failed to list neurology assessments");
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
      const assessment = await NeurologyAssessmentService.create({
        organisationId: params.data.organisationId,
        assessedBy: typedReq.userId ?? undefined,
        ...body.data,
        assessedAt: new Date(body.data.assessedAt),
      });
      return res.status(201).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to create neurology assessment");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const assessment = await NeurologyAssessmentService.get(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to get neurology assessment");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const assessment = await NeurologyAssessmentService.update(
        params.data.assessmentId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to update neurology assessment");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await NeurologyAssessmentService.delete(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete neurology assessment");
    }
  },
};
