import type { Request, Response } from "express";
import { z } from "zod";
import {
  OncologyAssessmentService,
  OncologyAssessmentError,
} from "src/services/oncology-assessment.service";
import type { OrgRequest } from "src/middlewares/rbac";

const OncologyStageEnum = z.enum([
  "STAGE_0",
  "STAGE_I",
  "STAGE_IA",
  "STAGE_IB",
  "STAGE_II",
  "STAGE_IIA",
  "STAGE_IIB",
  "STAGE_III",
  "STAGE_IIIA",
  "STAGE_IIIB",
  "STAGE_IV",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  tumorType: z.string().max(200).optional(),
  primaryTumorStage: z.string().max(10).optional(),
  nodeStage: z.string().max(10).optional(),
  metastasisStage: z.string().max(10).optional(),
  overallStage: OncologyStageEnum.optional(),
  chemotherapyProtocol: z.string().max(200).optional(),
  chemotherapyStartDate: z.string().datetime().optional(),
  chemotherapyCycles: z.number().int().min(1).max(100).optional(),
  qualityOfLifeScore: z.number().int().min(0).max(10).optional(),
  prognosis: z.string().max(3000).optional(),
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
  overallStage: OncologyStageEnum.optional(),
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
  if (err instanceof OncologyAssessmentError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const OncologyAssessmentController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const assessments = await OncologyAssessmentService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(assessments);
    } catch (err) {
      return handleError(err, res, "Failed to list oncology assessments");
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
      const assessment = await OncologyAssessmentService.create({
        organisationId: params.data.organisationId,
        assessedBy: typedReq.userId ?? undefined,
        ...body.data,
        assessedAt: new Date(body.data.assessedAt),
        chemotherapyStartDate: body.data.chemotherapyStartDate
          ? new Date(body.data.chemotherapyStartDate)
          : undefined,
      });
      return res.status(201).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to create oncology assessment");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const assessment = await OncologyAssessmentService.get(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to get oncology assessment");
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
      const assessment = await OncologyAssessmentService.update(
        params.data.assessmentId,
        params.data.organisationId,
        {
          ...body.data,
          chemotherapyStartDate: body.data.chemotherapyStartDate
            ? new Date(body.data.chemotherapyStartDate)
            : undefined,
        },
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to update oncology assessment");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await OncologyAssessmentService.delete(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete oncology assessment");
    }
  },
};
