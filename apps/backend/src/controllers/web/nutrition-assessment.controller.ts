import type { Request, Response } from "express";
import { z } from "zod";
import {
  NutritionAssessmentService,
  NutritionAssessmentError,
} from "src/services/nutrition-assessment.service";
import type { OrgRequest } from "src/middlewares/rbac";

const AppetiteScoreEnum = z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "NONE"]);
const FeedingRouteEnum = z.enum([
  "ORAL",
  "NASOGASTRIC",
  "ESOPHAGOSTOMY",
  "GASTROSTOMY",
  "IV_PARENTERAL",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  appetiteScore: AppetiteScoreEnum.optional(),
  bodyConditionScore: z.number().int().min(1).max(9).optional(),
  muscleConditionScore: z.number().int().min(1).max(4).optional(),
  currentWeightKg: z.number().positive().optional(),
  idealWeightKg: z.number().positive().optional(),
  restingEnergyRequirement: z.number().positive().optional(),
  feedingRoute: FeedingRouteEnum.optional(),
  currentDiet: z.string().max(500).optional(),
  feedingPlan: z.string().max(3000).optional(),
  supplementation: z.array(z.string().max(200)).optional(),
  hydrationStatus: z
    .enum([
      "ADEQUATE",
      "MILD_DEHYDRATION",
      "MODERATE_DEHYDRATION",
      "SEVERE_DEHYDRATION",
    ])
    .optional(),
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
  appetiteScore: AppetiteScoreEnum.optional(),
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
  if (err instanceof NutritionAssessmentError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const NutritionAssessmentController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const assessments = await NutritionAssessmentService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(assessments);
    } catch (err) {
      return handleError(err, res, "Failed to list nutrition assessments");
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
      const assessment = await NutritionAssessmentService.create({
        organisationId: params.data.organisationId,
        assessedBy: typedReq.userId ?? undefined,
        ...body.data,
        assessedAt: new Date(body.data.assessedAt),
      });
      return res.status(201).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to create nutrition assessment");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const assessment = await NutritionAssessmentService.get(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to get nutrition assessment");
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
      const assessment = await NutritionAssessmentService.update(
        params.data.assessmentId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to update nutrition assessment");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await NutritionAssessmentService.delete(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete nutrition assessment");
    }
  },
};
