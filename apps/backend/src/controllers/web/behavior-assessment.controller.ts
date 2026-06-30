import type { Request, Response } from "express";
import { z } from "zod";
import {
  BehaviorAssessmentService,
  BehaviorAssessmentError,
} from "src/services/behavior-assessment.service";
import type { OrgRequest } from "src/middlewares/rbac";

const FasScoreEnum = z.enum([
  "FAS_0",
  "FAS_1",
  "FAS_2",
  "FAS_3",
  "FAS_4",
  "FAS_5",
]);
const HandlingToleranceEnum = z.enum([
  "EASY",
  "MODERATE",
  "DIFFICULT",
  "EXTREME",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  fasScore: FasScoreEnum.optional(),
  nailTrimTolerance: HandlingToleranceEnum.optional(),
  handlingTolerance: HandlingToleranceEnum.optional(),
  aggressionTriggers: z.array(z.string().max(200)).optional(),
  aversionBehaviors: z.array(z.string().max(200)).optional(),
  trainingHistory: z.string().max(300).optional(),
  diagnoses: z.array(z.string().max(300)).optional(),
  referralRecommended: z.boolean().optional(),
  fearFreeNotes: z.string().max(3000).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  assessedAt: true,
}).partial();
const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  fasScore: FasScoreEnum.optional(),
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
  if (err instanceof BehaviorAssessmentError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const BehaviorAssessmentController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const assessments = await BehaviorAssessmentService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(assessments);
    } catch (err) {
      return handleError(err, res, "Failed to list behavior assessments");
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
      const assessment = await BehaviorAssessmentService.create({
        organisationId: params.data.organisationId,
        assessedBy: typedReq.userId ?? undefined,
        ...body.data,
        assessedAt: new Date(body.data.assessedAt),
      });
      return res.status(201).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to create behavior assessment");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const assessment = await BehaviorAssessmentService.get(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to get behavior assessment");
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
      const assessment = await BehaviorAssessmentService.update(
        params.data.assessmentId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to update behavior assessment");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await BehaviorAssessmentService.delete(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete behavior assessment");
    }
  },
};
