import { Request, Response } from "express";
import { z } from "zod";
import {
  InventoryCountService,
  InventoryCountError,
} from "src/services/inventory-count.service";

const RecordCountSchema = z.object({
  inventoryItemId: z.string().min(1),
  countedBy: z.string().optional(),
  countedAt: z.string().datetime(),
  systemCount: z.number().int().min(0),
  physicalCount: z.number().int().min(0),
  notes: z.string().optional(),
});

const ReconcileSchema = z.object({
  reconciledBy: z.string().min(1),
  notes: z.string().optional(),
});

const handleError = (res: Response, err: unknown) => {
  if (err instanceof InventoryCountError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  return res.status(500).json({ error: "Internal server error." });
};

export const InventoryCountController = {
  record: async (req: Request, res: Response) => {
    const parsed = RecordCountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const count = await InventoryCountService.record({
        organisationId: req.params.organisationId,
        inventoryItemId: parsed.data.inventoryItemId,
        countedBy: parsed.data.countedBy,
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
    const reconciledRaw = req.query.reconciled as string | undefined;
    const reconciled =
      reconciledRaw === "true"
        ? true
        : reconciledRaw === "false"
          ? false
          : undefined;
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
    const parsed = ReconcileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const count = await InventoryCountService.reconcile(
        req.params.countId,
        req.params.organisationId,
        parsed.data.reconciledBy,
        parsed.data.notes,
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
