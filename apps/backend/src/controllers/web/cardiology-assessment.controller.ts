import type { Request, Response } from "express";
import { z } from "zod";
import {
  CardiologyAssessmentService,
  CardiologyAssessmentError,
} from "src/services/cardiology-assessment.service";
import type { OrgRequest } from "src/middlewares/rbac";

const HeartRhythmEnum = z.enum([
  "NORMAL_SINUS",
  "SINUS_ARRHYTHMIA",
  "BRADYCARDIA",
  "TACHYCARDIA",
  "ATRIAL_FIBRILLATION",
  "SECOND_DEGREE_AV_BLOCK",
  "THIRD_DEGREE_AV_BLOCK",
  "VENTRICULAR_PREMATURE_CONTRACTIONS",
  "SUPRAVENTRICULAR_PREMATURE_CONTRACTIONS",
  "OTHER",
]);
const MurmurGradeEnum = z.enum([
  "GRADE_1",
  "GRADE_2",
  "GRADE_3",
  "GRADE_4",
  "GRADE_5",
  "GRADE_6",
]);
const AcvimClassEnum = z.enum(["A", "B1", "B2", "C", "D"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  assessedAt: z.string().datetime(),
  heartRate: z.number().int().min(1).max(500).optional(),
  heartRhythm: HeartRhythmEnum.optional(),
  murmurGrade: MurmurGradeEnum.optional(),
  murmurLocation: z.string().max(300).optional(),
  murmurCharacter: z.string().max(300).optional(),
  pulseQuality: z.string().max(300).optional(),
  jugularPulse: z.string().max(300).optional(),
  vertebralHeartScore: z.number().min(0).max(30).optional(),
  laAoRatio: z.number().min(0).max(10).optional(),
  fractionalShortening: z.number().min(0).max(100).optional(),
  ejectionFraction: z.number().min(0).max(100).optional(),
  acvimClass: AcvimClassEnum.optional(),
  findings: z.record(z.unknown()).optional(),
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
  acvimClass: AcvimClassEnum.optional(),
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
  if (err instanceof CardiologyAssessmentError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const CardiologyAssessmentController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const assessments = await CardiologyAssessmentService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(assessments);
    } catch (err) {
      return handleError(err, res, "Failed to list cardiology assessments");
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
      const assessment = await CardiologyAssessmentService.create({
        organisationId: params.data.organisationId,
        assessedBy: typedReq.userId ?? undefined,
        ...body.data,
        assessedAt: new Date(body.data.assessedAt),
      });
      return res.status(201).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to create cardiology assessment");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const assessment = await CardiologyAssessmentService.get(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to get cardiology assessment");
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
      const assessment = await CardiologyAssessmentService.update(
        params.data.assessmentId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(assessment);
    } catch (err) {
      return handleError(err, res, "Failed to update cardiology assessment");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = AssessmentParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await CardiologyAssessmentService.delete(
        params.data.assessmentId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete cardiology assessment");
    }
  },
};
