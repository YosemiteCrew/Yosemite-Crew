import type { Request, Response } from "express";
import { z } from "zod";
import {
  DentalExaminationService,
  DentalExaminationError,
} from "src/services/dental-examination.service";
import type { OrgRequest } from "src/middlewares/rbac";

const DentalGradeEnum = z.enum([
  "GRADE_0",
  "GRADE_1",
  "GRADE_2",
  "GRADE_3",
  "GRADE_4",
]);

const ToothFindingSchema = z.object({
  tooth: z.string().min(1).max(10),
  condition: z
    .enum([
      "NORMAL",
      "FRACTURE",
      "MISSING",
      "EXTRACTED",
      "SUPERNUMERARY",
      "PERSISTENT_DECIDUOUS",
      "GINGIVITIS",
      "PERIODONTITIS",
      "TOOTH_RESORPTION",
      "NEOPLASIA",
      "OTHER",
    ])
    .optional(),
  mobilityGrade: z
    .enum(["GRADE_0", "GRADE_1", "GRADE_2", "GRADE_3"])
    .optional(),
  calculus: z.number().int().min(0).max(3).optional(),
  periodontalDepth: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  examinedAt: z.string().datetime(),
  overallGrade: DentalGradeEnum,
  findings: z.array(ToothFindingSchema),
  calculusScore: z.number().int().min(0).max(3).optional(),
  plaqueScore: z.number().int().min(0).max(3).optional(),
  gingivalScore: z.number().int().min(0).max(3).optional(),
  procedures: z.array(z.string().max(300)).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = z.object({
  overallGrade: DentalGradeEnum.optional(),
  findings: z.array(ToothFindingSchema).optional(),
  calculusScore: z.number().int().min(0).max(3).optional(),
  plaqueScore: z.number().int().min(0).max(3).optional(),
  gingivalScore: z.number().int().min(0).max(3).optional(),
  procedures: z.array(z.string().max(300)).optional(),
  notes: z.string().max(3000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const ExamParamsSchema = z.object({
  organisationId: z.string().uuid(),
  examId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof DentalExaminationError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const DentalExaminationController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const exams = await DentalExaminationService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(exams);
    } catch (err) {
      return handleError(err, res, "Failed to list dental examinations");
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
      const exam = await DentalExaminationService.create({
        organisationId: params.data.organisationId,
        examinedBy: typedReq.userId ?? undefined,
        ...body.data,
        examinedAt: new Date(body.data.examinedAt),
      });
      return res.status(201).json(exam);
    } catch (err) {
      return handleError(err, res, "Failed to create dental examination");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ExamParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const exam = await DentalExaminationService.get(
        params.data.examId,
        params.data.organisationId,
      );
      return res.status(200).json(exam);
    } catch (err) {
      return handleError(err, res, "Failed to get dental examination");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ExamParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const exam = await DentalExaminationService.update(
        params.data.examId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(exam);
    } catch (err) {
      return handleError(err, res, "Failed to update dental examination");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ExamParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await DentalExaminationService.delete(
        params.data.examId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete dental examination");
    }
  },
};
