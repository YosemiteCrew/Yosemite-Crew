import type { Request, Response } from "express";
import { z } from "zod";
import {
  OphthalmologyExaminationService,
  OphthalmologyExaminationError,
} from "src/services/ophthalmology-examination.service";
import type { OrgRequest } from "src/middlewares/rbac";

const VisionStatusEnum = z.enum(["NORMAL", "REDUCED", "ABSENT", "UNKNOWN"]);
const PLRResponseEnum = z.enum(["NORMAL", "SLUGGISH", "ABSENT"]);

const EyeFindingSchema = z.object({
  discharge: z
    .enum(["ABSENT", "SEROUS", "MUCOID", "PURULENT", "HAEMORRHAGIC"])
    .optional(),
  cornealClarity: z
    .enum(["CLEAR", "HAZE", "OEDEMA", "ULCER", "OPACITY"])
    .optional(),
  lensClarity: z
    .enum([
      "CLEAR",
      "EARLY_CATARACT",
      "MATURE_CATARACT",
      "HYPERMATURE_CATARACT",
    ])
    .optional(),
  vitreousClarity: z
    .enum(["CLEAR", "HAZE", "HAEMORRHAGE", "FLOATERS"])
    .optional(),
  retina: z
    .enum(["NORMAL", "DETACHED", "DEGENERATIVE", "HAEMORRHAGE", "PAPILLOEDEMA"])
    .optional(),
  conjunctiva: z
    .enum(["NORMAL", "HYPERAEMIC", "CHEMOSIS", "FOLLICLES"])
    .optional(),
  notes: z.string().max(1000).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  examinedAt: z.string().datetime(),
  visionLeft: VisionStatusEnum.optional(),
  visionRight: VisionStatusEnum.optional(),
  menaceLeft: z.boolean().optional(),
  menaceRight: z.boolean().optional(),
  plrDirectLeft: PLRResponseEnum.optional(),
  plrDirectRight: PLRResponseEnum.optional(),
  plrConsensualLeft: PLRResponseEnum.optional(),
  plrConsensualRight: PLRResponseEnum.optional(),
  sttLeft: z.number().int().min(0).max(50).optional(),
  sttRight: z.number().int().min(0).max(50).optional(),
  iopLeft: z.number().min(0).max(100).optional(),
  iopRight: z.number().min(0).max(100).optional(),
  fluoresceinLeft: z.boolean().optional(),
  fluoresceinRight: z.boolean().optional(),
  findingsLeft: EyeFindingSchema.optional(),
  findingsRight: EyeFindingSchema.optional(),
  diagnoses: z.array(z.string().max(300)).optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  examinedAt: true,
}).partial();
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
  if (err instanceof OphthalmologyExaminationError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const OphthalmologyExaminationController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const exams = await OphthalmologyExaminationService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(exams);
    } catch (err) {
      return handleError(err, res, "Failed to list ophthalmology examinations");
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
      const exam = await OphthalmologyExaminationService.create({
        organisationId: params.data.organisationId,
        examinedBy: typedReq.userId ?? undefined,
        ...body.data,
        examinedAt: new Date(body.data.examinedAt),
      });
      return res.status(201).json(exam);
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to create ophthalmology examination",
      );
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ExamParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const exam = await OphthalmologyExaminationService.get(
        params.data.examId,
        params.data.organisationId,
      );
      return res.status(200).json(exam);
    } catch (err) {
      return handleError(err, res, "Failed to get ophthalmology examination");
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
      const exam = await OphthalmologyExaminationService.update(
        params.data.examId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(exam);
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to update ophthalmology examination",
      );
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ExamParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await OphthalmologyExaminationService.delete(
        params.data.examId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(
        err,
        res,
        "Failed to delete ophthalmology examination",
      );
    }
  },
};
