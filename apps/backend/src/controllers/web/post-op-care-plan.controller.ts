import type { Request, Response } from "express";
import { z } from "zod";
import {
  PostOpCarePlanService,
  PostOpCarePlanError,
} from "src/services/post-op-care-plan.service";
import type { OrgRequest } from "src/middlewares/rbac";

const StatusEnum = z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]);

const CreateBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  surgicalProcedureId: z.string().uuid().optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  analgesiaProtocol: z.string().max(2000).optional(),
  woundCareInstructions: z.string().max(5000).optional(),
  activityRestrictions: z.string().max(2000).optional(),
  dietaryNotes: z.string().max(2000).optional(),
  fluidTherapyNotes: z.string().max(2000).optional(),
  monitoringParams: z.string().max(2000).optional(),
  firstReviewAt: z.string().datetime().optional(),
  nextReviewAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const ReviewBodySchema = z.object({
  painScore: z.number().int().min(0).max(10).optional(),
  reviewNotes: z.string().min(1).max(5000),
  nextReviewAt: z.string().datetime().optional(),
  status: StatusEnum.optional(),
});

const UpdateBodySchema = z.object({
  analgesiaProtocol: z.string().max(2000).optional(),
  woundCareInstructions: z.string().max(5000).optional(),
  activityRestrictions: z.string().max(2000).optional(),
  dietaryNotes: z.string().max(2000).optional(),
  fluidTherapyNotes: z.string().max(2000).optional(),
  monitoringParams: z.string().max(2000).optional(),
  firstReviewAt: z.string().datetime().optional(),
  nextReviewAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  status: StatusEnum.optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  status: StatusEnum.optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const PlanParamsSchema = z.object({
  organisationId: z.string().uuid(),
  planId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof PostOpCarePlanError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

const parseDates = (data: Record<string, unknown>) => {
  const out = { ...data };
  if (typeof out.firstReviewAt === "string")
    out.firstReviewAt = new Date(out.firstReviewAt);
  if (typeof out.nextReviewAt === "string")
    out.nextReviewAt = new Date(out.nextReviewAt);
  return out;
};

export const PostOpCarePlanController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await PostOpCarePlanService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list post-op care plans");
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
      const record = await PostOpCarePlanService.create({
        organisationId: params.data.organisationId,
        prescribedBy: typedReq.userId ?? undefined,
        ...parseDates(body.data as Record<string, unknown>),
      } as Parameters<typeof PostOpCarePlanService.create>[0]);
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to create post-op care plan");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await PostOpCarePlanService.get(
        params.data.planId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get post-op care plan");
    }
  },

  review: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = ReviewBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { nextReviewAt, ...rest } = body.data;
      const record = await PostOpCarePlanService.review(
        params.data.planId,
        params.data.organisationId,
        {
          ...rest,
          ...(nextReviewAt ? { nextReviewAt: new Date(nextReviewAt) } : {}),
        },
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to review post-op care plan");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = PlanParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await PostOpCarePlanService.update(
        params.data.planId,
        params.data.organisationId,
        parseDates(body.data as Record<string, unknown>) as Parameters<
          typeof PostOpCarePlanService.update
        >[2],
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update post-op care plan");
    }
  },
};
