/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-assignment */
import { Request, Response } from "express";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { OrgRequest } from "src/middlewares/rbac";
import {
  InventoryService,
  InventoryAdjustmentService,
  InventoryAllocationService,
  InventoryVendorService,
  InventoryMetaFieldService,
  InventoryAlertService,
  InventoryServiceError,
  BusinessType,
  InventoryStatus,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  InventoryBatchInput,
  ConsumeStockInput,
  BulkConsumeStockInput,
} from "src/services/inventory.service";
import type { InventoryStockStatus } from "src/services/inventory.catalog";
import {
  InventoryItemDocument,
  InventoryBatchDocument,
  InventoryVendorDocument,
  InventoryMetaFieldDocument,
} from "src/models/inventory";
import logger from "src/utils/logger";

type EmptyParams = Record<string, never>;

/**
 * Common error handler to keep controllers clean
 */
const handleError = (error: unknown, res: Response): void => {
  if (error instanceof InventoryServiceError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }
  logger.error("Inventory controller error", { error });
  const message =
    error instanceof Error ? error.message : "Internal Server Error";
  res.status(500).json({ message });
};

/**
 * Helper to resolve userId (for audit / adjustments / allocations)
 */
const resolveUserId = (req: Request): string | undefined => {
  const authReq = req as AuthenticatedRequest;
  return authReq.userId;
};

/**
 * Query types for list/search endpoints
 */
interface ListItemsQuery {
  businessType?: string;
  category?: string;
  subCategory?: string;
  vendor?: string;
  search?: string;
  status?: string; // comma-separated
  stockStatus?: string; // comma-separated
  lowStockOnly?: string; // "true"/"false"
  expiredOnly?: string; // "true"/"false"
  expiringWithinDays?: string; // number as string
  sortBy?: "name" | "stock" | "expiryDate" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: string;
  pageSize?: string;
}

interface ExpiringItemsQuery {
  days?: string;
}

interface ListMetaFieldsQuery {
  businessType?: string;
}

/**
 * INVENTORY ITEM + BATCH + STOCK CONTROLLER
 */
export const InventoryController = {
  // ─────────────────────────────────────────────
  // ITEM: CREATE
  // ─────────────────────────────────────────────
  createItem: async (
    req: Request<EmptyParams, InventoryItemDocument, CreateInventoryItemInput>,
    res: Response,
  ): Promise<void> => {
    try {
      const input = req.body;

      const item = await InventoryService.createItem(input);
      res.status(201).json(item);
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // ITEM: UPDATE
  // ─────────────────────────────────────────────
  updateItem: async (
    req: Request<
      { itemId: string },
      InventoryItemDocument,
      UpdateInventoryItemInput
    >,
    res: Response,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const input = req.body;
      const { organisationId } = req as OrgRequest;

      const item = await InventoryService.updateItem(
        itemId,
        input,
        organisationId!,
      );
      res.json(item);
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // ITEM: HIDE
  // ─────────────────────────────────────────────
  hideItem: async (
    req: Request<{ itemId: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const { organisationId } = req as OrgRequest;
      const item = await InventoryService.hideItem(itemId, organisationId!);
      res.json(item);
    } catch (error) {
      handleError(error, res);
    }
  },

  activeItem: async (
    req: Request<{ itemId: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const { organisationId } = req as OrgRequest;
      const item = await InventoryService.activeItem(itemId, organisationId!);
      res.json(item);
    } catch (error) {
      handleError(error, res);
    }
  },

  toggleItemStatus: async (
    req: Request<{ itemId: string }, unknown, { active?: boolean }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const { organisationId } = req as OrgRequest;
      const active = Boolean(req.body?.active);
      const item = active
        ? await InventoryService.activeItem(itemId, organisationId!)
        : await InventoryService.hideItem(itemId, organisationId!);
      res.json(item);
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // ITEM: ARCHIVE (DELETED)
  // ─────────────────────────────────────────────
  archiveItem: async (
    req: Request<{ itemId: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const { organisationId } = req as OrgRequest;
      const item = await InventoryService.archiveItem(itemId, organisationId!);
      res.json(item);
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // ITEM: LIST (ORG-SCOPED)
  // ─────────────────────────────────────────────
  listItems: async (
    req: Request<{ organisationId: string }, unknown, unknown, ListItemsQuery>,
    res: Response,
  ): Promise<void> => {
    try {
      const { organisationId } = req.params;
      const {
        businessType,
        category,
        subCategory,
        vendor,
        search,
        status,
        stockStatus,
        lowStockOnly,
        expiredOnly,
        expiringWithinDays,
        sortBy,
        sortOrder,
        page,
        pageSize,
      } = req.query;

      let parsedStatus: InventoryStatus | InventoryStatus[] | undefined;
      if (status) {
        const parts = status.split(",").map((s) => s.trim());
        if (parts.length === 1) {
          parsedStatus = parts[0] as InventoryStatus;
        } else {
          parsedStatus = parts as InventoryStatus[];
        }
      }

      let parsedStockStatus: string | string[] | undefined;
      if (stockStatus) {
        const parts = stockStatus.split(",").map((s) => s.trim());
        parsedStockStatus = parts.length === 1 ? parts[0] : parts;
      }

      const filter = {
        organisationId,
        businessType: businessType as BusinessType | undefined,
        category,
        subCategory,
        vendor,
        search,
        status: parsedStatus,
        stockStatus: parsedStockStatus as
          | InventoryStockStatus
          | InventoryStockStatus[]
          | undefined,
        lowStockOnly: lowStockOnly === "true",
        expiredOnly: expiredOnly === "true",
        expiringWithinDays: expiringWithinDays
          ? Number(expiringWithinDays)
          : undefined,
        sortBy,
        sortOrder,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      } satisfies {
        organisationId: string;
        businessType?: BusinessType;
        category?: string;
        subCategory?: string;
        vendor?: string;
        search?: string;
        status?: InventoryStatus | InventoryStatus[];
        stockStatus?: InventoryStockStatus | InventoryStockStatus[];
        lowStockOnly?: boolean;
        expiredOnly?: boolean;
        expiringWithinDays?: number;
        sortBy?: "name" | "stock" | "expiryDate" | "createdAt";
        sortOrder?: "asc" | "desc";
        page?: number;
        pageSize?: number;
      };

      const items = await InventoryService.listItems(filter);
      res.json(items);
    } catch (error) {
      handleError(error, res);
    }
  },

  getCategories: async (_req: Request, res: Response): Promise<void> => {
    try {
      const categories = await InventoryService.getCategories();
      res.json({ categories });
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // ITEM: DETAIL (with batches)
  // ─────────────────────────────────────────────
  getItemWithBatches: async (
    req: Request<{ itemId: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const { organisationId } = req as OrgRequest;
      const result = await InventoryService.getItemWithBatches(
        itemId,
        organisationId!,
      );
      res.json(result);
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // BATCH: ADD
  // ─────────────────────────────────────────────
  addBatch: async (
    req: Request<
      { itemId: string },
      InventoryBatchDocument,
      InventoryBatchInput
    >,
    res: Response,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const batchInput = req.body;

      const batch = await InventoryService.addBatch(itemId, batchInput);
      res.status(201).json(batch);
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // BATCH: UPDATE
  // ─────────────────────────────────────────────
  updateBatch: async (
    req: Request<
      { batchId: string },
      InventoryBatchDocument,
      Partial<InventoryBatchInput>
    >,
    res: Response,
  ): Promise<void> => {
    try {
      const { batchId } = req.params;
      const updates = req.body;

      const batch = await InventoryService.updateBatch(batchId, updates);
      res.json(batch);
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // BATCH: DELETE
  // ─────────────────────────────────────────────
  deleteBatch: async (
    req: Request<{ batchId: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { batchId } = req.params;
      await InventoryService.deleteBatch(batchId);
      res.status(204).send();
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // STOCK: CONSUME (FIFO by expiry)
  // ─────────────────────────────────────────────
  consumeStock: async (
    req: Request<EmptyParams, InventoryItemDocument, ConsumeStockInput>,
    res: Response,
  ): Promise<void> => {
    try {
      const input = req.body;
      const item = await InventoryService.consumeStock(input);
      res.json(item);
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // STOCK: CONSUME (BULK)
  // ─────────────────────────────────────────────
  bulkConsumeStock: async (
    req: Request<EmptyParams, InventoryItemDocument[], BulkConsumeStockInput>,
    res: Response,
  ): Promise<void> => {
    try {
      const input = req.body;
      const items = await InventoryService.bulkConsumeStock(input);
      res.json(items);
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // STOCK: MANUAL ADJUSTMENT
  // ─────────────────────────────────────────────
  adjustStock: async (
    req: Request<
      { itemId: string },
      InventoryItemDocument,
      { newOnHand: number; reason: string }
    >,
    res: Response,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const { newOnHand, reason } = req.body;

      const userId = resolveUserId(req);

      const item = await InventoryAdjustmentService.adjustStock({
        itemId,
        newOnHand,
        reason,
        userId,
      });

      res.json(item);
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // STOCK: ALLOCATE
  // ─────────────────────────────────────────────
  allocateStock: async (
    req: Request<
      { itemId: string },
      InventoryItemDocument,
      { quantity: number; referenceId: string }
    >,
    res: Response,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const { quantity, referenceId } = req.body;

      const item = await InventoryAllocationService.allocateStock({
        itemId,
        quantity,
        referenceId,
      });

      res.json(item);
    } catch (error) {
      handleError(error, res);
    }
  },

  // ─────────────────────────────────────────────
  // STOCK: RELEASE ALLOCATED
  // ─────────────────────────────────────────────
  releaseAllocatedStock: async (
    req: Request<
      { itemId: string },
      InventoryItemDocument,
      { quantity: number; referenceId: string }
    >,
    res: Response,
  ): Promise<void> => {
    try {
      const { itemId } = req.params;
      const { quantity, referenceId } = req.body;

      const item = await InventoryAllocationService.releaseAllocatedStock({
        itemId,
        quantity,
        referenceId,
      });

      res.json(item);
    } catch (error) {
      handleError(error, res);
    }
  },

  getInventoryTurnOver: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;

      const from = req.query.from
        ? new Date(req.query.from as string)
        : undefined;

      const to = req.query.to ? new Date(req.query.to as string) : undefined;

      const result = await InventoryService.getInventoryTurnoverByItem({
        organisationId,
        from,
        to,
      });

      res.status(200).json({
        organisationId,
        from: from ?? "last_12_months",
        to: to ?? new Date(),
        items: result,
      });
    } catch (error) {
      if (error instanceof InventoryServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      logger.error("Failed to get inventory turnover", error);
      return res
        .status(500)
        .json({ message: "Failed to load inventory turnover" });
    }
  },
};

/**
 * VENDOR CONTROLLER
 */
export const InventoryVendorController = {
  createVendor: async (
    req: Request<
      EmptyParams,
      InventoryVendorDocument,
      {
        organisationId: string;
        name: string;
        brand?: string;
        vendorType?: string;
        licenseNumber?: string;
        paymentTerms?: string;
        deliveryFrequency?: string;
        leadTimeDays?: number;
        contactInfo?: {
          phone?: string;
          email?: string;
          address?: string;
        };
      }
    >,
    res: Response,
  ): Promise<void> => {
    try {
      const vendor = await InventoryVendorService.createVendor(req.body);
      res.status(201).json(vendor);
    } catch (error) {
      handleError(error, res);
    }
  },

  updateVendor: async (
    req: Request<
      { vendorId: string },
      unknown,
      Partial<{
        name: string;
        brand?: string;
        vendorType?: string;
        licenseNumber?: string;
        paymentTerms?: string;
        deliveryFrequency?: string;
        leadTimeDays?: number;
        contactInfo?: {
          phone?: string;
          email?: string;
          address?: string;
        };
      }>
    >,
    res: Response,
  ): Promise<void> => {
    try {
      const { vendorId } = req.params;
      const updated = await InventoryVendorService.updateVendor(
        vendorId,
        req.body,
      );
      res.json(updated);
    } catch (error) {
      handleError(error, res);
    }
  },

  listVendors: async (
    req: Request<{ organisationId: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { organisationId } = req.params;
      const list = await InventoryVendorService.listVendors(organisationId);
      res.json(list);
    } catch (error) {
      handleError(error, res);
    }
  },

  getVendor: async (
    req: Request<{ vendorId: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { vendorId } = req.params;
      const vendor = await InventoryVendorService.getVendor(vendorId);
      if (!vendor) {
        res.status(404).json({ message: "Vendor not found" });
        return;
      }
      res.json(vendor);
    } catch (error) {
      handleError(error, res);
    }
  },

  deleteVendor: async (
    req: Request<{ vendorId: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { vendorId } = req.params;
      await InventoryVendorService.deleteVendor(vendorId);
      res.status(204).send();
    } catch (error) {
      handleError(error, res);
    }
  },
};

/**
 * META FIELD CONTROLLER (dynamic attributes per business type)
 */
export const InventoryMetaFieldController = {
  createField: async (
    req: Request<
      EmptyParams,
      unknown,
      {
        businessType: string;
        fieldKey: string;
        label: string;
        values: string[];
      }
    >,
    res: Response,
  ): Promise<void> => {
    try {
      const field = await InventoryMetaFieldService.createField(req.body);
      res.status(201).json(field);
    } catch (error) {
      handleError(error, res);
    }
  },

  updateField: async (
    req: Request<
      { fieldId: string },
      unknown,
      Partial<{
        label: string;
        values: string[];
      }>
    >,
    res: Response,
  ): Promise<void> => {
    try {
      const { fieldId } = req.params;
      const updated = await InventoryMetaFieldService.updateField(
        fieldId,
        req.body,
      );
      res.json(updated);
    } catch (error) {
      handleError(error, res);
    }
  },

  deleteField: async (
    req: Request<{ fieldId: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { fieldId } = req.params;
      await InventoryMetaFieldService.deleteField(fieldId);
      res.status(204).send();
    } catch (error) {
      handleError(error, res);
    }
  },

  listFields: async (
    req: Request<EmptyParams, unknown, unknown, ListMetaFieldsQuery>,
    res: Response,
  ): Promise<void> => {
    try {
      const { businessType } = req.query;

      if (!businessType) {
        res.status(400).json({ message: "businessType is required" });
        return;
      }

      const fields = await InventoryMetaFieldService.listFields(businessType);
      res.json(fields);
    } catch (error) {
      handleError(error, res);
    }
  },
};

/**
 * ALERT CONTROLLER (low stock, expiring)
 */
export const InventoryAlertController = {
  getLowStockItems: async (
    req: Request<{ organisationId: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { organisationId } = req.params;
      const items =
        await InventoryAlertService.getLowStockItems(organisationId);
      res.json(items);
    } catch (error) {
      handleError(error, res);
    }
  },

  getExpiringItems: async (
    req: Request<
      { organisationId: string },
      unknown,
      unknown,
      ExpiringItemsQuery
    >,
    res: Response,
  ): Promise<void> => {
    try {
      const { organisationId } = req.params;
      const { days } = req.query;
      const parsedDays = days ? Number(days) : 7;

      const batches = await InventoryAlertService.getExpiringItems(
        organisationId,
        parsedDays,
      );
      res.json(batches);
    } catch (error) {
      handleError(error, res);
    }
  },
};
