import type { Request, Response } from "express";
import { z } from "zod";
import {
  PainAssessmentService,
  PainAssessmentError,
} from "src/services/pain-assessment.service";
import type { OrgRequest } from "src/middlewares/rbac";

const PainScaleEnum = z.enum([
  "NUMERIC_0_10",
  "COLORADO_ACUTE_PAIN_SCALE",
  "GLASGOW_COMPOSITE_PAIN_SCALE",
  "UNESP_BOTUCATU",
  "FELINE_GRIMACE_SCALE",
]);
const PainInterventionEnum = z.enum([
  "ANALGESIC_GIVEN",
  "REPOSITIONED",
  "ICE_APPLIED",
  "BANDAGE_ADJUSTED",
  "ENVIRONMENT_MODIFIED",
  "REASSESSED",
  "OTHER",
]);

const RecordBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  painScale: PainScaleEnum,
  painScore: z.number().int().min(0).max(10),
  rawScore: z.string().max(50).optional(),
  behaviouralSigns: z.string().max(1000).optional(),
  vocalisation: z.boolean().optional(),
  posture: z.string().max(500).optional(),
  assessedAt: z.string().datetime(),
  interventionType: PainInterventionEnum.optional(),
  interventionDetail: z.string().max(1000).optional(),
  reassessAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
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
  if (err instanceof PainAssessmentError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const PainAssessmentController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const { from, to, ...rest } = query.data;
      const records = await PainAssessmentService.list({
        organisationId: params.data.organisationId,
        ...rest,
        ...(from ? { from: new Date(from) } : {}),
        ...(to ? { to: new Date(to) } : {}),
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list pain assessments");
    }
  },

  record: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = RecordBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { assessedAt, reassessAt, ...rest } = body.data;
      const assessment = await PainAssessmentService.record({
        organisationId: params.data.organisationId,
        assessedBy: typedReq.userId ?? undefined,
        ...rest,
        assessedAt: new Date(assessedAt),
        ...(reassessAt ? { reassessAt: new Date(reassessAt) } : {}),
      });
      return res.status(201).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to record pain assessment");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const assessment = await PainAssessmentService.get(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to get pain assessment");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await PainAssessmentService.delete(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete pain assessment");
    }
  },
};
