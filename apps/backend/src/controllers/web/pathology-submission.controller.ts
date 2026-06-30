import type { Request, Response } from "express";
import { z } from "zod";
import {
  PathologySubmissionService,
  PathologySubmissionError,
} from "src/services/pathology-submission.service";
import type { OrgRequest } from "src/middlewares/rbac";

const PathologyTypeEnum = z.enum([
  "HISTOPATHOLOGY",
  "CYTOLOGY",
  "CULTURE_SENSITIVITY",
  "HAEMATOLOGY",
  "BIOCHEMISTRY",
  "URINALYSIS",
  "PCR",
  "SEROLOGY",
  "NECROPSY",
  "OTHER",
]);
const PathologyStatusEnum = z.enum([
  "PENDING",
  "RECEIVED_BY_LAB",
  "PROCESSING",
  "RESULTS_AVAILABLE",
  "REVIEWED",
]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  pathologyType: PathologyTypeEnum,
  sampleType: z.string().min(1).max(300),
  anatomicSite: z.string().min(1).max(500),
  collectedAt: z.string().datetime(),
  submittedAt: z.string().datetime().optional(),
  labName: z.string().max(300).optional(),
  labRefNumber: z.string().max(200).optional(),
  clinicalHistory: z.string().max(3000).optional(),
  differentials: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

const RecordResultsBodySchema = z.object({
  results: z.string().min(1).max(10000),
  diagnosis: z.string().max(2000).optional(),
  interpretation: z.string().max(3000).optional(),
  status: PathologyStatusEnum.optional(),
});

const ReviewBodySchema = z.object({
  reviewNotes: z.string().max(3000).optional(),
  diagnosis: z.string().max(2000).optional(),
  interpretation: z.string().max(3000).optional(),
});

const UpdateBodySchema = z.object({
  submittedAt: z.string().datetime().optional(),
  labName: z.string().max(300).optional(),
  labRefNumber: z.string().max(200).optional(),
  clinicalHistory: z.string().max(3000).optional(),
  differentials: z.string().max(2000).optional(),
  status: PathologyStatusEnum.optional(),
  notes: z.string().max(2000).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  status: PathologyStatusEnum.optional(),
  pathologyType: PathologyTypeEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const SubmissionParamsSchema = z.object({
  organisationId: z.string().uuid(),
  submissionId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof PathologySubmissionError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

export const PathologySubmissionController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const submissions = await PathologySubmissionService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(submissions);
    } catch (err) {
      return handleError(err, res, "Failed to list pathology submissions");
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
      const { collectedAt, submittedAt, ...rest } = body.data;
      const submission = await PathologySubmissionService.create({
        organisationId: params.data.organisationId,
        collectedBy: typedReq.userId ?? undefined,
        ...rest,
        collectedAt: new Date(collectedAt),
        ...(submittedAt ? { submittedAt: new Date(submittedAt) } : {}),
      });
      return res.status(201).json(submission);
    } catch (err) {
      return handleError(err, res, "Failed to create pathology submission");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = SubmissionParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const submission = await PathologySubmissionService.get(
        params.data.submissionId,
        params.data.organisationId,
      );
      return res.status(200).json(submission);
    } catch (err) {
      return handleError(err, res, "Failed to get pathology submission");
    }
  },

  recordResults: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = SubmissionParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = RecordResultsBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const submission = await PathologySubmissionService.recordResults(
        params.data.submissionId,
        params.data.organisationId,
        body.data,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(submission);
    } catch (err) {
      return handleError(err, res, "Failed to record pathology results");
    }
  },

  review: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = SubmissionParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = ReviewBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const submission = await PathologySubmissionService.review(
        params.data.submissionId,
        params.data.organisationId,
        body.data,
        typedReq.userId ?? "unknown",
      );
      return res.status(200).json(submission);
    } catch (err) {
      return handleError(err, res, "Failed to review pathology submission");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = SubmissionParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { submittedAt, ...rest } = body.data;
      const submission = await PathologySubmissionService.update(
        params.data.submissionId,
        params.data.organisationId,
        {
          ...rest,
          ...(submittedAt ? { submittedAt: new Date(submittedAt) } : {}),
        },
      );
      return res.status(200).json(submission);
    } catch (err) {
      return handleError(err, res, "Failed to update pathology submission");
    }
  },
};
