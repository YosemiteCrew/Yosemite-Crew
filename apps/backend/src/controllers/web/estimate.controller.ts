import { z } from "zod";
import type { Request, Response } from "express";
import { EstimateService } from "src/services/estimate.service";

const EstimateStatusEnum = z.enum([
  "DRAFT",
  "SENT",
  "APPROVED",
  "DECLINED",
  "EXPIRED",
  "CONVERTED",
]);

const EstimateItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

const CreateEstimateSchema = z.object({
  patientId: z.string(),
  encounterId: z.string().optional(),
  validUntil: z.string().datetime().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional(),
  items: z.array(EstimateItemSchema).min(1),
});

const UpdateEstimateSchema = z.object({
  validUntil: z.string().datetime().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional(),
  items: z.array(EstimateItemSchema).optional(),
});

// Path params are strings as far as Express is concerned, but parsing them here
// states that invariant instead of relying on it: these values go straight into a
// Prisma `where`, and an object arriving where a string is expected would change
// what the query matches. Follows the same pattern as companion-card.controller.
const ConvertParamsSchema = z.object({
  organisationId: z.string().min(1),
  estimateId: z.string().min(1),
});

const ApproveDeclineSchema = z.object({
  reason: z.string().optional(),
});

const getSessionUserId = (req: Request): string | undefined =>
  (req as unknown as { userId?: string }).userId;

export const estimateController = {
  create: async (req: Request, res: Response) => {
    const { organisationId } = req.params;
    const parsed = CreateEstimateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { validUntil, ...rest } = parsed.data;
    try {
      const estimate = await EstimateService.create({
        organisationId,
        ...rest,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        createdBy: (req as unknown as { userId?: string }).userId,
      });
      res.status(201).json(estimate);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  get: async (req: Request, res: Response) => {
    const { organisationId, estimateId } = req.params;
    try {
      const estimate = await EstimateService.get(estimateId, organisationId);
      res.json(estimate);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  list: async (req: Request, res: Response) => {
    const { organisationId } = req.params;
    const statusResult = EstimateStatusEnum.safeParse(req.query.status);
    try {
      const estimates = await EstimateService.list({
        organisationId,
        patientId: req.query.patientId as string | undefined,
        status: statusResult.success ? statusResult.data : undefined,
      });
      res.json(estimates);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  update: async (req: Request, res: Response) => {
    const { organisationId, estimateId } = req.params;
    const parsed = UpdateEstimateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { validUntil, ...rest } = parsed.data;
    try {
      const estimate = await EstimateService.update(
        estimateId,
        organisationId,
        {
          ...rest,
          validUntil: validUntil ? new Date(validUntil) : undefined,
        },
      );
      res.json(estimate);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  markSent: async (req: Request, res: Response) => {
    const { organisationId, estimateId } = req.params;
    try {
      const estimate = await EstimateService.markSent(
        estimateId,
        organisationId,
      );
      res.json(estimate);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  approve: async (req: Request, res: Response) => {
    const { organisationId, estimateId } = req.params;
    const approvedBy = getSessionUserId(req);
    if (!approvedBy) {
      res.status(401).json({ error: "Unauthorized: User ID missing" });
      return;
    }
    const parsed = ApproveDeclineSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const estimate = await EstimateService.approve(
        estimateId,
        organisationId,
        approvedBy,
      );
      res.json(estimate);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  convert: async (req: Request, res: Response) => {
    const params = ConvertParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.flatten() });
      return;
    }
    const { organisationId, estimateId } = params.data;
    const convertedBy = getSessionUserId(req);
    if (!convertedBy) {
      res.status(401).json({ error: "Unauthorized: User ID missing" });
      return;
    }
    try {
      const estimate = await EstimateService.convert(
        estimateId,
        organisationId,
        convertedBy,
      );
      res.json(estimate);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  decline: async (req: Request, res: Response) => {
    const { organisationId, estimateId } = req.params;
    const declinedBy = getSessionUserId(req);
    if (!declinedBy) {
      res.status(401).json({ error: "Unauthorized: User ID missing" });
      return;
    }
    const parsed = ApproveDeclineSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const estimate = await EstimateService.decline(
        estimateId,
        organisationId,
        declinedBy,
        parsed.data.reason,
      );
      res.json(estimate);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },

  delete: async (req: Request, res: Response) => {
    const { organisationId, estimateId } = req.params;
    try {
      await EstimateService.delete(estimateId, organisationId);
      res.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      res.status(e.statusCode ?? 500).json({ error: e.message });
    }
  },
};
