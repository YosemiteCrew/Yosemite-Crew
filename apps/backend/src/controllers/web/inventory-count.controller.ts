import { Request, Response } from "express";
import type { AuthenticatedRequest } from "src/middlewares/auth";
import { z } from "zod";
import {
  InventoryCountService,
  InventoryCountError,
} from "src/services/inventory-count.service";
import { parseOptionalBooleanFlag } from "src/utils/query-flags";

const RecordCountSchema = z
  .object({
    inventoryItemId: z.string().min(1),
    inventoryBatchId: z.string().min(1).optional(),
    countedAt: z.iso.datetime(),
    systemCount: z.number().int().min(0).optional(),
    physicalCount: z.number().int().min(0),
    notes: z.string().optional(),
  })
  .refine(
    (value) => value.inventoryBatchId || value.systemCount !== undefined,
    {
      message: "A batch or system count is required.",
    },
  );

const ReconcileSchema = z.object({
  resolution: z.enum(["STOCK_ADJUSTED", "NO_CHANGE"]),
  resolutionNotes: z.string().max(1000).optional(),
});

const handleError = (res: Response, err: unknown) => {
  if (err instanceof InventoryCountError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  return res.status(500).json({ error: "Internal server error." });
};

export const InventoryCountController = {
  record: async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });
    const parsed = RecordCountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.flattenError(parsed.error) });
    }
    try {
      const count = await InventoryCountService.record({
        organisationId: req.params.organisationId,
        inventoryItemId: parsed.data.inventoryItemId,
        inventoryBatchId: parsed.data.inventoryBatchId,
        countedBy: userId,
        countedAt: new Date(parsed.data.countedAt),
        systemCount: parsed.data.systemCount,
        physicalCount: parsed.data.physicalCount,
        notes: parsed.data.notes,
      });
      return res.status(201).json(count);
    } catch (err) {
      return handleError(res, err);
    }
  },

  get: async (req: Request, res: Response) => {
    try {
      const count = await InventoryCountService.get(
        req.params.countId,
        req.params.organisationId,
      );
      return res.json(count);
    } catch (err) {
      return handleError(res, err);
    }
  },

  list: async (req: Request, res: Response) => {
    const inventoryItemId = req.query.inventoryItemId as string | undefined;
    const inventoryBatchId =
      typeof req.query.inventoryBatchId === "string"
        ? req.query.inventoryBatchId
        : undefined;
    const reconciled = parseOptionalBooleanFlag(req.query.reconciled);
    const fromDate = req.query.fromDate
      ? new Date(req.query.fromDate as string)
      : undefined;
    const toDate = req.query.toDate
      ? new Date(req.query.toDate as string)
      : undefined;

    try {
      const counts = await InventoryCountService.list({
        organisationId: req.params.organisationId,
        inventoryItemId,
        inventoryBatchId,
        reconciled,
        fromDate,
        toDate,
      });
      return res.json(counts);
    } catch (err) {
      return handleError(res, err);
    }
  },

  reconcile: async (req: Request, res: Response) => {
    const userId = (req as AuthenticatedRequest).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized." });
    const parsed = ReconcileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: z.flattenError(parsed.error) });
    }
    try {
      const count = await InventoryCountService.reconcile(
        req.params.countId,
        req.params.organisationId,
        userId,
        parsed.data.resolution,
        parsed.data.resolutionNotes,
      );
      return res.json(count);
    } catch (err) {
      return handleError(res, err);
    }
  },

  unreconciled: async (req: Request, res: Response) => {
    try {
      const counts = await InventoryCountService.unreconciled(
        req.params.organisationId,
      );
      return res.json(counts);
    } catch (err) {
      return handleError(res, err);
    }
  },
};
