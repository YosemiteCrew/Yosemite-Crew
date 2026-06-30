import type { Request, Response } from "express";
import { z } from "zod";
import {
  DiagnosticImageService,
  DiagnosticImageError,
} from "src/services/diagnostic-image.service";
import type { OrgRequest } from "src/middlewares/rbac";

const ImagingTypeEnum = z.enum([
  "RADIOGRAPH",
  "ULTRASOUND",
  "CT_SCAN",
  "MRI",
  "ENDOSCOPY",
  "FLUOROSCOPY",
  "SCINTIGRAPHY",
  "OTHER",
]);
const ImagingStatusEnum = z.enum([
  "PENDING_REVIEW",
  "REVIEWED",
  "REQUIRES_SPECIALIST",
]);

const RecordBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  imagingType: ImagingTypeEnum,
  bodyRegion: z.string().max(200).optional(),
  indication: z.string().max(1000).optional(),
  takenAt: z.string().datetime(),
  takenBy: z.string().max(200).optional(),
  interpretedBy: z.string().max(200).optional(),
  interpretedAt: z.string().datetime().optional(),
  findings: z.string().max(5000).optional(),
  impression: z.string().max(2000).optional(),
  followUpRequired: z.boolean().optional(),
  documentId: z.string().uuid().optional(),
});

const ReviewBodySchema = z.object({
  interpretedBy: z.string().max(200),
  findings: z.string().max(5000),
  impression: z.string().max(2000).optional(),
  followUpRequired: z.boolean().optional(),
  status: ImagingStatusEnum.optional(),
});

const UpdateBodySchema = z.object({
  bodyRegion: z.string().max(200).optional(),
  indication: z.string().max(1000).optional(),
  takenBy: z.string().max(200).optional(),
  findings: z.string().max(5000).optional(),
  impression: z.string().max(2000).optional(),
  followUpRequired: z.boolean().optional(),
  documentId: z.string().uuid().optional(),
  status: ImagingStatusEnum.optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  imagingType: ImagingTypeEnum.optional(),
  status: ImagingStatusEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const ImageParamsSchema = z.object({
  organisationId: z.string().uuid(),
  imageId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof DiagnosticImageError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const DiagnosticImageController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await DiagnosticImageService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list diagnostic images");
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
      const { takenAt, interpretedAt, ...rest } = body.data;
      const record = await DiagnosticImageService.record({
        organisationId: params.data.organisationId,
        takenBy: typedReq.userId ?? undefined,
        ...rest,
        takenAt: new Date(takenAt),
        ...(interpretedAt ? { interpretedAt: new Date(interpretedAt) } : {}),
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to record diagnostic image");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ImageParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await DiagnosticImageService.get(
        params.data.imageId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get diagnostic image");
    }
  },

  review: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = ImageParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = ReviewBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await DiagnosticImageService.review(
        params.data.imageId,
        params.data.organisationId,
        body.data,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to review diagnostic image");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = ImageParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await DiagnosticImageService.update(
        params.data.imageId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update diagnostic image");
    }
  },
};
