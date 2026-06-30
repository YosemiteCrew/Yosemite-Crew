import type { Request, Response } from "express";
import { z } from "zod";
import {
  QolAssessmentService,
  QolAssessmentError,
} from "src/services/qol-assessment.service";
import type { OrgRequest } from "src/middlewares/rbac";

const HhScore = z.number().int().min(1).max(10);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  hhhhhmmScore: z.number().int().min(0).max(70).optional(),
  painScore: HhScore.optional(),
  appetiteScore: HhScore.optional(),
  hygieneScore: HhScore.optional(),
  happinessScore: HhScore.optional(),
  mobilityScore: HhScore.optional(),
  moreDaysGood: z.boolean().optional(),
  overallScore: z.number().int().min(0).max(100).optional(),
  ownerAssessed: z.boolean().optional(),
  clinicianNotes: z.string().max(3000).optional(),
  ownerNotes: z.string().max(3000).optional(),
  euthanasiaDiscussed: z.boolean().optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({ patientId: true }).partial();
const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  ownerAssessed: z
    .string()
    .optional()
    .transform((v) =>
      v === "true" ? true : v === "false" ? false : undefined,
    ),
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
  if (err instanceof QolAssessmentError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const QolAssessmentController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await QolAssessmentService.list({
        organisationId: params.data.organisationId,
        patientId: query.data.patientId,
        encounterId: query.data.encounterId,
        ownerAssessed: query.data.ownerAssessed,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list QoL assessments");
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
      const record = await QolAssessmentService.create({
        organisationId: params.data.organisationId,
        assessedBy: typedReq.userId ?? undefined,
        ...body.data,
        assessedAt: new Date(body.data.assessedAt),
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to create QoL assessment");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await QolAssessmentService.get(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get QoL assessment");
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
      const { assessedAt, ...rest } = body.data;
      const record = await QolAssessmentService.update(
        params.data.assessmentId,
        params.data.organisationId,
        {
          ...rest,
          ...(assessedAt ? { assessedAt: new Date(assessedAt) } : {}),
        },
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update QoL assessment");
    }
  },

  trend: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const patientId = req.query.patientId as string | undefined;
      if (!patientId)
        return res.status(400).json({ message: "patientId is required" });
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : undefined;
      const records = await QolAssessmentService.trend(
        patientId,
        params.data.organisationId,
        limit,
      );
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to get QoL assessment trend");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await QolAssessmentService.delete(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete QoL assessment");
    }
  },
};
