import type { Request, Response } from "express";
import { z } from "zod";
import { PocLabService, PocLabError } from "src/services/poc-lab.service";
import type { OrgRequest } from "src/middlewares/rbac";

const PocTestTypeEnum = z.enum([
  "CBC",
  "BLOOD_CHEMISTRY",
  "URINALYSIS",
  "FECAL_FLOAT",
  "CYTOLOGY",
  "COAGULATION",
  "ELECTROLYTES",
  "THYROID_PANEL",
  "CORTISOL",
  "GLUCOSE_CURVE",
  "BLOOD_GAS",
  "OTHER",
]);

const LabResultParamSchema = z.object({
  name: z.string().min(1).max(100),
  value: z.union([z.number(), z.string()]),
  unit: z.string().max(50).optional(),
  referenceRangeLow: z.number().optional(),
  referenceRangeHigh: z.number().optional(),
  flag: z.enum(["H", "L", "HH", "LL", "N"]).optional(),
});

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  conductedAt: z.string().datetime(),
  testType: PocTestTypeEnum,
  analyzerName: z.string().max(200).optional(),
  sampleType: z.string().max(100).optional(),
  results: z.array(LabResultParamSchema).min(1),
  overallInterpretation: z.string().max(3000).optional(),
  abnormalFlags: z.array(z.string().max(100)).optional(),
  criticalFlags: z.array(z.string().max(100)).optional(),
  followUpRecommended: z.boolean().optional(),
  notes: z.string().max(3000).optional(),
});

const UpdateBodySchema = z.object({
  overallInterpretation: z.string().max(3000).optional(),
  abnormalFlags: z.array(z.string().max(100)).optional(),
  criticalFlags: z.array(z.string().max(100)).optional(),
  followUpRecommended: z.boolean().optional(),
  notes: z.string().max(3000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  testType: PocTestTypeEnum.optional(),
});
const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const RecordParamsSchema = z.object({
  organisationId: z.string().uuid(),
  recordId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof PocLabError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const PocLabController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await PocLabService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list POC lab results");
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
      const record = await PocLabService.create({
        organisationId: params.data.organisationId,
        conductedBy: typedReq.userId ?? undefined,
        ...body.data,
        conductedAt: new Date(body.data.conductedAt),
      });
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to create POC lab result");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = RecordParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await PocLabService.get(
        params.data.recordId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get POC lab result");
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
      const record = await PocLabService.update(
        params.data.recordId,
        params.data.organisationId,
        body.data,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update POC lab result");
    }
  },

  delete: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = RecordParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      await PocLabService.delete(
        params.data.recordId,
        params.data.organisationId,
      );
      return res.status(204).send();
    } catch (err) {
      return handleError(err, res, "Failed to delete POC lab result");
    }
  },
};
