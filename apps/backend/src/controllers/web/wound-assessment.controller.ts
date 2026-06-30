import type { Request, Response } from "express";
import { z } from "zod";
import {
  WoundAssessmentService,
  WoundAssessmentError,
} from "src/services/wound-assessment.service";
import type { OrgRequest } from "src/middlewares/rbac";

const WoundTypeEnum = z.enum([
  "SURGICAL_INCISION",
  "LACERATION",
  "PUNCTURE",
  "ABRASION",
  "BURN",
  "PRESSURE_SORE",
  "ULCER",
  "BITE_WOUND",
  "OTHER",
]);
const HealingStageEnum = z.enum([
  "HAEMOSTASIS",
  "INFLAMMATION",
  "PROLIFERATION",
  "MATURATION",
]);
const HealingStatusEnum = z.enum([
  "HEALING",
  "STATIC",
  "DETERIORATING",
  "HEALED",
  "COMPLICATED",
]);

const RecordBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  surgicalProcedureId: z.string().uuid().optional(),
  woundType: WoundTypeEnum,
  location: z.string().min(1).max(500),
  lengthCm: z.number().min(0).optional(),
  widthCm: z.number().min(0).optional(),
  depthCm: z.number().min(0).optional(),
  healingStage: HealingStageEnum.optional(),
  healingStatus: HealingStatusEnum.optional(),
  exudateType: z.string().max(200).optional(),
  exudateAmount: z.string().max(200).optional(),
  odour: z.string().max(200).optional(),
  woundBed: z.string().max(500).optional(),
  woundEdges: z.string().max(500).optional(),
  periwoundSkin: z.string().max(500).optional(),
  dressing: z.string().max(500).optional(),
  dressingChangeFreq: z.string().max(200).optional(),
  assessedAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  surgicalProcedureId: z.string().uuid().optional(),
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
  if (err instanceof WoundAssessmentError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const WoundAssessmentController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const { from, to, ...rest } = query.data;
      const records = await WoundAssessmentService.list({
        organisationId: params.data.organisationId,
        ...rest,
        ...(from ? { from: new Date(from) } : {}),
        ...(to ? { to: new Date(to) } : {}),
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list wound assessments");
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
      const { assessedAt, ...rest } = body.data;
      const assessment = await WoundAssessmentService.record({
        organisationId: params.data.organisationId,
        assessedBy: typedReq.userId ?? undefined,
        ...rest,
        assessedAt: new Date(assessedAt),
      });
      return res.status(201).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to record wound assessment");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const assessment = await WoundAssessmentService.get(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to get wound assessment");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await WoundAssessmentService.delete(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete wound assessment");
    }
  },
};
