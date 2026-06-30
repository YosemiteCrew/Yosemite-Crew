import type { Request, Response } from "express";
import { z } from "zod";
import {
  BloodTransfusionService,
  BloodTransfusionError,
} from "src/services/blood-transfusion.service";
import type { OrgRequest } from "src/middlewares/rbac";

const BloodTypeEnum = z.enum([
  "DEA_1_POSITIVE",
  "DEA_1_NEGATIVE",
  "TYPE_A",
  "TYPE_B",
  "TYPE_AB",
  "UNKNOWN",
]);
const ReactionEnum = z.enum([
  "NONE",
  "FEBRILE",
  "HAEMOLYTIC",
  "ALLERGIC",
  "ANAPHYLACTIC",
  "CIRCULATORY_OVERLOAD",
  "OTHER",
]);

const RecordBodySchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  donorId: z.string().max(200).optional(),
  productType: z.string().min(1).max(200),
  bloodType: BloodTypeEnum,
  volumeMl: z.number().positive(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  reaction: ReactionEnum.optional(),
  reactionNotes: z.string().max(2000).optional(),
  crossMatchDone: z.boolean().optional(),
  crossMatchResult: z.string().max(500).optional(),
  preTransfusionPCV: z.number().min(0).max(100).optional(),
  postTransfusionPCV: z.number().min(0).max(100).optional(),
});

const ReactionBodySchema = z.object({
  reaction: ReactionEnum,
  reactionNotes: z.string().max(2000).optional(),
});

const UpdateBodySchema = z.object({
  endedAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  reaction: ReactionEnum.optional(),
  reactionNotes: z.string().max(2000).optional(),
  crossMatchResult: z.string().max(500).optional(),
  postTransfusionPCV: z.number().min(0).max(100).optional(),
});

const ListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
});

const OrgParamsSchema = z.object({ organisationId: z.string().uuid() });
const TransfusionParamsSchema = z.object({
  organisationId: z.string().uuid(),
  transfusionId: z.string().uuid(),
});

const handleError = (
  err: unknown,
  res: Response,
  fallback: string,
): Response => {
  if (err instanceof BloodTransfusionError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  return res.status(500).json({ message: fallback });
};

const parseDates = (data: {
  startedAt?: string;
  endedAt?: string;
  [key: string]: unknown;
}) => ({
  ...data,
  ...(data.startedAt ? { startedAt: new Date(data.startedAt) } : {}),
  ...(data.endedAt ? { endedAt: new Date(data.endedAt) } : {}),
});

export const BloodTransfusionController = {
  list: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = OrgParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const query = ListQuerySchema.safeParse(req.query);
      if (!query.success)
        return res.status(400).json({ message: query.error.message });
      const records = await BloodTransfusionService.list({
        organisationId: params.data.organisationId,
        ...query.data,
      });
      return res.status(200).json(records);
    } catch (err) {
      return handleError(err, res, "Failed to list transfusions");
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
      const record = await BloodTransfusionService.record({
        organisationId: params.data.organisationId,
        administeredBy: typedReq.userId ?? undefined,
        ...parseDates(body.data),
      } as Parameters<typeof BloodTransfusionService.record>[0]);
      return res.status(201).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to record transfusion");
    }
  },

  get: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = TransfusionParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const record = await BloodTransfusionService.get(
        params.data.transfusionId,
        params.data.organisationId,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to get transfusion");
    }
  },

  reportReaction: async (req: Request, res: Response): Promise<Response> => {
    try {
      const typedReq = req as OrgRequest;
      const params = TransfusionParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = ReactionBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const record = await BloodTransfusionService.reportReaction(
        params.data.transfusionId,
        params.data.organisationId,
        body.data,
        typedReq.userId ?? undefined,
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to report reaction");
    }
  },

  update: async (req: Request, res: Response): Promise<Response> => {
    try {
      const params = TransfusionParamsSchema.safeParse(req.params);
      if (!params.success)
        return res.status(400).json({ message: "Invalid route parameters" });
      const body = UpdateBodySchema.safeParse(req.body);
      if (!body.success)
        return res.status(400).json({ message: body.error.message });
      const { endedAt, ...rest } = body.data;
      const record = await BloodTransfusionService.update(
        params.data.transfusionId,
        params.data.organisationId,
        {
          ...rest,
          ...(endedAt ? { endedAt: new Date(endedAt) } : {}),
        },
      );
      return res.status(200).json(record);
    } catch (err) {
      return handleError(err, res, "Failed to update transfusion");
    }
  },
};
