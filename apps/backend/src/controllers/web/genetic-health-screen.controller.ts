import type { Request, Response } from "express";
import { z } from "zod";
import {
  GeneticHealthScreenService,
  GeneticHealthScreenError,
} from "src/services/genetic-health-screen.service";
import type { OrgRequest } from "src/middlewares/rbac";

const GeneticResultEnum = z.enum([
  "CLEAR",
  "CARRIER",
  "AFFECTED",
  "AFFECTED_MINOR",
  "INCONCLUSIVE",
  "PENDING",
]);
const OrthoRatingEnum = z.enum([
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "BORDERLINE",
  "MILD",
  "MODERATE",
  "SEVERE",
  "NOT_EVALUABLE",
]);
const DnaTestSchema = z.object({
  disease: z.string().min(1).max(200),
  gene: z.string().max(50).optional(),
  result: GeneticResultEnum,
  laboratoryId: z.string().max(100).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  screenedAt: z.string().datetime(),
  laboratoryName: z.string().max(200).optional(),
  dnaTests: z.array(DnaTestSchema).optional(),
  ofa_hips: OrthoRatingEnum.optional(),
  ofa_elbows: OrthoRatingEnum.optional(),
  ofa_patellas: OrthoRatingEnum.optional(),
  ofa_cardiac: z.string().max(200).optional(),
  ofa_eyes: z.string().max(200).optional(),
  certificateNumber: z.string().max(100).optional(),
  certificationExpiry: z.string().datetime().optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = CreateBodySchema.omit({
  patientId: true,
  screenedAt: true,
}).partial();
const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
});
const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const RecordParamsSchema = z.object({
  organisationId: z.string().uuid(),
  screenId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof GeneticHealthScreenError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const GeneticHealthScreenController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await GeneticHealthScreenService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list genetic health screens");
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
      const record = await GeneticHealthScreenService.create({
        organisationId: params.data.organisationId,
        screenedBy: typedReq.userId ?? undefined,
        ...body.data,
        screenedAt: new Date(body.data.screenedAt),
        certificationExpiry: body.data.certificationExpiry
          ? new Date(body.data.certificationExpiry)
          : undefined,
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to create genetic health screen");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = RecordParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await GeneticHealthScreenService.get(
        params.data.screenId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get genetic health screen");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = RecordParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await GeneticHealthScreenService.update(
        params.data.screenId,
        params.data.organisationId,
        {
          ...body.data,
          certificationExpiry: body.data.certificationExpiry
            ? new Date(body.data.certificationExpiry)
            : undefined,
        },
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update genetic health screen");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = RecordParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await GeneticHealthScreenService.delete(
        params.data.screenId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete genetic health screen");
    }
  },
};
