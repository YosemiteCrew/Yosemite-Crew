import type { Request, Response } from "express";
import { z } from "zod";
import {
  DermatologyAssessmentService,
  DermatologyAssessmentError,
} from "src/services/dermatology-assessment.service";
import type { OrgRequest } from "src/middlewares/rbac";

const LesionMapRegionSchema = z.object({
  region: z.string().min(1).max(100),
  lesions: z.array(z.string().max(200)),
  severity: z.enum(["MILD", "MODERATE", "SEVERE"]).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  pruritusScore: z.number().int().min(0).max(10).optional(),
  affectedRegions: z.array(z.string().max(200)).optional(),
  primaryLesions: z.array(z.string().max(200)).optional(),
  secondaryLesions: z.array(z.string().max(200)).optional(),
  coatQuality: z.enum(["GOOD", "FAIR", "POOR", "ALOPECIA"]).optional(),
  lesionMap: z.array(LesionMapRegionSchema).optional(),
  environmentalAllergens: z.array(z.string().max(200)).optional(),
  foodTrialStatus: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "INCONCLUSIVE"])
    .optional(),
  cades04Score: z.number().int().min(0).max(60).optional(),
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
  if (err instanceof DermatologyAssessmentError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const DermatologyAssessmentController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const assessments = await DermatologyAssessmentService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(assessments);
    } catch (err) {
      return handleError(err, res, "Failed to list dermatology assessments");
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
      const assessment = await DermatologyAssessmentService.create({
        organisationId: params.data.organisationId,
        assessedBy: typedReq.userId ?? undefined,
        ...body.data,
        assessedAt: new Date(body.data.assessedAt),
      });
      return res.status(201).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to create dermatology assessment");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const assessment = await DermatologyAssessmentService.get(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to get dermatology assessment");
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
      const assessment = await DermatologyAssessmentService.update(
        params.data.assessmentId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to update dermatology assessment");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await DermatologyAssessmentService.delete(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete dermatology assessment");
    }
  },
};
