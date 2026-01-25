// src/services/inventory.service.ts
import dayjs from "dayjs";
import { FilterQuery, Types } from "mongoose";
import {
  InventoryItemModel,
  InventoryBatchModel,
  InventoryVendorModel,
  InventoryMetaFieldModel,
  StockMovementModel,
} from "src/models/inventory";
import type {
  InventoryItemDocument,
  InventoryBatchDocument,
  InventoryVendorDocument,
  InventoryMetaFieldDocument,
  InventoryItemMongo,
  InventoryVendorMongo,
} from "src/models/inventory";

// Make sure this matches your schema's BusinessType
export type BusinessType =
  | "HOSPITAL"
  | "GROOMING"
  | "BOARDING"
  | "BREEDING"
  | "GENERAL";

export type InventoryStatus = "ACTIVE" | "HIDDEN" | "DELETED";

export type StockHealthStatus =
  | "HEALTHY"
  | "LOW_STOCK"
  | "EXPIRED"
  | "EXPIRING_SOON";

type InventoryListItem = InventoryItemMongo & {
  _id: Types.ObjectId;
  stockHealth: StockHealthStatus;
  batches?: InventoryBatchDocument[];
};

export class InventoryServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "InventoryServiceError";
  }
}

/**
 * INPUT TYPES
 */

export interface InventoryAttributeMap {
  [key: string]: string | number | boolean | null;
}

export interface InventoryBatchInput {
  batchNumber?: string;
  lotNumber?: string;
  regulatoryTrackingId?: string;
  manufactureDate?: Date;
  expiryDate?: Date;
  minShelfLifeAlertDate?: Date;
  quantity: number;
  allocated?: number;
}

export interface CreateInventoryItemInput {
  organisationId: string;
  businessType: BusinessType;

  name: string;
  sku?: string;
  category: string;
  subCategory?: string;

  description?: string;
  imageUrl?: string;

  attributes?: InventoryAttributeMap;

  unitCost?: number;
  sellingPrice?: number;
  currency?: string;
  reorderLevel?: number;

  initialOnHand?: number;
  initialAllocated?: number;

  vendorId?: string;

  status?: InventoryStatus;

  batches?: InventoryBatchInput[];
}

export interface UpdateInventoryItemInput {
  name?: string;
  sku?: string;
  category?: string;
  subCategory?: string;

  description?: string;
  imageUrl?: string;

  attributes?: InventoryAttributeMap;

  unitCost?: number | null;
  sellingPrice?: number | null;
  currency?: string | null;
  reorderLevel?: number | null;

  vendorId?: string | null;

  status?: InventoryStatus;
}

export interface ListInventoryFilter {
  organisationId: string;
  businessType?: BusinessType;
  category?: string;
  subCategory?: string;
  search?: string;
  status?: InventoryStatus | InventoryStatus[];
  lowStockOnly?: boolean;
  expiredOnly?: boolean;
  expiringWithinDays?: number;
}

export interface ConsumeStockInput {
  itemId: string;
  quantity: number;
  reason:
    | "APPOINTMENT_USAGE"
    | "MANUAL_ADJUSTMENT"
    | "GROOMING_USAGE"
    | "BOARDING_USAGE"
    | "OTHER";
  referenceId?: string;
}

export interface BulkConsumeStockInput {
  items: ConsumeStockInput[];
}

export interface StockMovementInput {
  itemId: string;
  batchId?: string;
  change: number;
  reason: string;
  referenceId?: string;
  userId?: string;
}

/**
 * HELPER: Calculate stock status for UI
 */
const computeStockHealthStatus = (args: {
  onHand: number;
  reorderLevel?: number | null;
  soonThresholdDays?: number;
  nearestExpiry?: Date | null;
}): StockHealthStatus => {
  const { onHand, reorderLevel, nearestExpiry, soonThresholdDays = 7 } = args;

  const now = dayjs();
  if (nearestExpiry && dayjs(nearestExpiry).isBefore(now, "day")) {
    return "EXPIRED";
  }

  if (
    nearestExpiry &&
    dayjs(nearestExpiry).isBefore(now.add(soonThresholdDays, "day"), "day")
  ) {
    return "EXPIRING_SOON";
  }

  if (reorderLevel != null && onHand <= reorderLevel) {
    return "LOW_STOCK";
  }

  return "HEALTHY";
};

export type InventoryTurnoverStatus =
  | "EXCELLENT"
  | "HEALTHY"
  | "MODERATE"
  | "LOW";

export interface InventoryTurnoverRow {
  itemId: string;
  itemName: string;
  subCategory?: string;

  beginningInventory: number;
  endingInventory: number;
  avgInventory: number;

  totalPurchases: number;
  turnsPerYear: number;
  daysOnShelf: number;

  status: InventoryTurnoverStatus;
}

/**
 * HELPER: Recompute onHand and allocated from batches
 */
const recomputeStockFromBatches = async (
  itemId: string,
): Promise<{
  onHand: number;
  allocated: number;
  nearestExpiry: Date | null;
}> => {
  const batches = await InventoryBatchModel.find({ itemId }).lean();

  let onHand = 0;
  let allocated = 0;
  let nearestExpiry: Date | null = null;

  for (const b of batches) {
    onHand += b.quantity ?? 0;
    allocated += b.allocated ?? 0;

    if (b.expiryDate) {
      if (!nearestExpiry || b.expiryDate < nearestExpiry) {
        nearestExpiry = b.expiryDate;
      }
    }
  }

  return { onHand, allocated, nearestExpiry };
};

/**
 * HELPER: validate ObjectId
 */
const ensureObjectId = (id: string, fieldName = "id") => {
  if (!Types.ObjectId.isValid(id)) {
    throw new InventoryServiceError(`Invalid ${fieldName}`, 400);
  }
};

/**
 * HELPER: log stock movment
 */
const logMovement = async (payload: StockMovementInput) => {
  await StockMovementModel.create({
    ...payload,
    createdAt: new Date(),
  });
};

const computeTurnoverStatus = (
  turnsPerYear: number,
): InventoryTurnoverStatus => {
  if (turnsPerYear >= 12) return "EXCELLENT";
  if (turnsPerYear >= 6) return "HEALTHY";
  if (turnsPerYear >= 3) return "MODERATE";
  return "LOW";
};

export const InventoryService = {
  // ─────────────────────────────────────────────
  // CREATE ITEM (optionally with initial batches)
  // ─────────────────────────────────────────────
  async createItem(input: CreateInventoryItemInput) {
    if (!input.organisationId) {
      throw new InventoryServiceError("organisationId is required", 400);
    }
    if (!input.name) {
      throw new InventoryServiceError("name is required", 400);
    }
    if (!input.category) {
      throw new InventoryServiceError("category is required", 400);
    }

    // 1. Create item with basic data (onHand will be recomputed if batches)
    const item = await InventoryItemModel.create({
      organisationId: input.organisationId,
      businessType: input.businessType,

      name: input.name,
      sku: input.sku,
      category: input.category,
      subCategory: input.subCategory,

      description: input.description,
      imageUrl: input.imageUrl,

      attributes: input.attributes ?? {},

      unitCost: input.unitCost ?? undefined,
      sellingPrice: input.sellingPrice ?? undefined,
      currency: input.currency ?? "USD",
      reorderLevel: input.reorderLevel ?? undefined,

      vendorId: input.vendorId ?? undefined,

      onHand: input.initialOnHand ?? 0,
      allocated: input.initialAllocated ?? 0,

      status: input.status ?? "ACTIVE",
    });

    // 2. If batches were provided, insert them and recompute stock
    if (input.batches && input.batches.length) {
      const payloads = input.batches.map((b) => ({
        itemId: item._id.toString(),
        organisationId: item.organisationId,
        batchNumber: b.batchNumber,
        lotNumber: b.lotNumber,
        regulatoryTrackingId: b.regulatoryTrackingId,
        manufactureDate: b.manufactureDate,
        expiryDate: b.expiryDate,
        minShelfLifeAlertDate: b.minShelfLifeAlertDate,
        quantity: b.quantity,
        allocated: b.allocated ?? 0,
      }));

      await InventoryBatchModel.insertMany(payloads);

      const { onHand, allocated } = await recomputeStockFromBatches(
        item._id.toString(),
      );
      item.onHand = onHand;
      item.allocated = allocated;
      await item.save();
    }

    const batches = await InventoryBatchModel.find({
      itemId: item._id.toString(),
      organisationId: item.organisationId,
    })
      .sort({ expiryDate: 1 })
      .exec();

    return {
      item,
      batches,
    };
  },

  // ─────────────────────────────────────────────
  // UPDATE ITEM
  // ─────────────────────────────────────────────
  async updateItem(itemId: string, input: UpdateInventoryItemInput) {
    ensureObjectId(itemId, "itemId");

    const item = await InventoryItemModel.findById(itemId).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }

    if (input.name !== undefined) item.name = input.name;
    if (input.sku !== undefined) item.sku = input.sku;
    if (input.category !== undefined) item.category = input.category;
    if (input.subCategory !== undefined) item.subCategory = input.subCategory;

    if (input.description !== undefined) item.description = input.description;
    if (input.imageUrl !== undefined) item.imageUrl = input.imageUrl;

    if (input.attributes !== undefined) {
      item.attributes = input.attributes;
    }

    if (input.unitCost !== undefined)
      item.unitCost = input.unitCost ?? undefined;
    if (input.sellingPrice !== undefined)
      item.sellingPrice = input.sellingPrice ?? undefined;
    if (input.currency !== undefined)
      item.currency = input.currency ?? undefined;
    if (input.reorderLevel !== undefined)
      item.reorderLevel = input.reorderLevel ?? undefined;

    if (input.vendorId !== undefined)
      item.vendorId = input.vendorId ?? undefined;

    if (input.status !== undefined) item.status = input.status;

    await item.save();

    const batches = await InventoryBatchModel.find({
      itemId,
      organisationId: item.organisationId,
    })
      .sort({ expiryDate: 1 })
      .exec();

    return {
      item,
      batches,
    };
  },

  // ─────────────────────────────────────────────
  // SOFT HIDE / ARCHIVE (map to HIDDEN / DELETED)
  // ─────────────────────────────────────────────
  async hideItem(itemId: string): Promise<InventoryItemDocument> {
    ensureObjectId(itemId, "itemId");
    const item = await InventoryItemModel.findById(itemId).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }
    item.status = "HIDDEN";
    await item.save();
    return item;
  },

  async archiveItem(itemId: string): Promise<InventoryItemDocument> {
    ensureObjectId(itemId, "itemId");
    const item = await InventoryItemModel.findById(itemId).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }
    item.status = "DELETED";
    await item.save();
    return item;
  },

  async activeItem(itemId: string): Promise<InventoryItemDocument> {
    ensureObjectId(itemId, "itemId");
    const item = await InventoryItemModel.findById(itemId).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }
    item.status = "ACTIVE";
    await item.save();
    return item;
  },

  // ─────────────────────────────────────────────
  // LIST ITEMS (table view)
  // ─────────────────────────────────────────────
  async listItems(filter: ListInventoryFilter): Promise<InventoryListItem[]> {
    const query: FilterQuery<InventoryItemMongo> = {
      organisationId: filter.organisationId,
    };

    if (filter.businessType) query.businessType = filter.businessType;

    if (filter.category) query.category = filter.category;
    if (filter.subCategory) query.subCategory = filter.subCategory;

    if (filter.status) {
      if (Array.isArray(filter.status)) query.status = { $in: filter.status };
      else query.status = filter.status;
    } else {
      // default: exclude deleted
      query.status = { $ne: "DELETED" };
    }

    if (filter.search) {
      const s = filter.search.trim();
      if (s) {
        query.$or = [
          { name: { $regex: s, $options: "i" } },
          { sku: { $regex: s, $options: "i" } },
          { description: { $regex: s, $options: "i" } },
        ];
      }
    }

    const items = await InventoryItemModel.find(query).sort({ name: 1 }).exec();

    const itemIds = items.map((i) => i._id.toString());
    const batches = await InventoryBatchModel.find({
      itemId: { $in: itemIds },
    }).exec();

    const batchesByItem = new Map<string, InventoryBatchDocument[]>();
    for (const b of batches) {
      const key = b.itemId.toString();
      if (!batchesByItem.has(key)) batchesByItem.set(key, []);
      batchesByItem.get(key)!.push(b);
    }

    const result: InventoryListItem[] = [];

    for (const item of items) {
      const itemBatches = batchesByItem.get(item._id.toString()) ?? [];
      let nearestExpiry: Date | null = null;
      for (const b of itemBatches) {
        if (b.expiryDate) {
          if (!nearestExpiry || b.expiryDate < nearestExpiry) {
            nearestExpiry = b.expiryDate;
          }
        }
      }

      const stockHealth = computeStockHealthStatus({
        onHand: item.onHand ?? 0,
        reorderLevel: item.reorderLevel ?? null,
        nearestExpiry,
        soonThresholdDays: filter.expiringWithinDays ?? 7,
      });

      // Apply extra filters
      if (filter.lowStockOnly && stockHealth !== "LOW_STOCK") continue;
      if (filter.expiredOnly && stockHealth !== "EXPIRED") continue;
      if (
        filter.expiringWithinDays &&
        !(stockHealth === "EXPIRING_SOON" || stockHealth === "EXPIRED")
      ) {
        continue;
      }

      const itemObject = item.toObject();
      result.push({ ...itemObject, stockHealth, batches: itemBatches });
    }

    return result;
  },

  // ─────────────────────────────────────────────
  // DETAIL VIEW: Item + batches
  // ─────────────────────────────────────────────
  async getItemWithBatches(
    itemId: string,
    organisationId: string,
  ): Promise<{
    item: InventoryItemDocument;
    batches: InventoryBatchDocument[];
  }> {
    ensureObjectId(itemId, "itemId");

    const [item, batches] = await Promise.all([
      InventoryItemModel.findById(itemId).exec(),
      InventoryBatchModel.find({ itemId, organisationId })
        .sort({ expiryDate: 1 })
        .exec(),
    ]);

    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }

    return { item, batches };
  },

  // ─────────────────────────────────────────────
  // BATCH OPERATIONS
  // ─────────────────────────────────────────────
  async addBatch(
    itemId: string,
    batchInput: InventoryBatchInput,
  ): Promise<InventoryBatchDocument> {
    ensureObjectId(itemId);

    const item = await InventoryItemModel.findById(itemId);
    if (!item) throw new InventoryServiceError("Inventory item not found", 404);

    const batch = await InventoryBatchModel.create({
      itemId,
      organisationId: item.organisationId,
      batchNumber: batchInput.batchNumber,
      lotNumber: batchInput.lotNumber,
      regulatoryTrackingId: batchInput.regulatoryTrackingId,
      manufactureDate: batchInput.manufactureDate,
      expiryDate: batchInput.expiryDate,
      minShelfLifeAlertDate: batchInput.minShelfLifeAlertDate,
      quantity: batchInput.quantity,
      allocated: batchInput.allocated ?? 0,
    });

    const { onHand, allocated } = await recomputeStockFromBatches(itemId);
    item.onHand = onHand;
    item.allocated = allocated;
    await item.save();

    return batch;
  },

  async updateBatch(
    batchId: string,
    input: Partial<InventoryBatchInput>,
  ): Promise<InventoryBatchDocument> {
    ensureObjectId(batchId, "batchId");

    const batch = await InventoryBatchModel.findById(batchId).exec();
    if (!batch) {
      throw new InventoryServiceError("Batch not found", 404);
    }

    if (input.batchNumber !== undefined) batch.batchNumber = input.batchNumber;
    if (input.lotNumber !== undefined) batch.lotNumber = input.lotNumber;
    if (input.regulatoryTrackingId !== undefined)
      batch.regulatoryTrackingId = input.regulatoryTrackingId;
    if (input.manufactureDate !== undefined)
      batch.manufactureDate = input.manufactureDate;
    if (input.expiryDate !== undefined) batch.expiryDate = input.expiryDate;
    if (input.minShelfLifeAlertDate !== undefined)
      batch.minShelfLifeAlertDate = input.minShelfLifeAlertDate;
    if (input.quantity !== undefined) batch.quantity = input.quantity;
    if (input.allocated !== undefined) batch.allocated = input.allocated;

    await batch.save();

    // recompute stock
    const { onHand, allocated } = await recomputeStockFromBatches(
      batch.itemId.toString(),
    );
    await InventoryItemModel.findByIdAndUpdate(batch.itemId, {
      onHand,
      allocated,
    }).exec();

    return batch;
  },

  async deleteBatch(batchId: string): Promise<void> {
    ensureObjectId(batchId, "batchId");

    const batch = await InventoryBatchModel.findById(batchId).exec();
    if (!batch) return;

    const itemId = batch.itemId.toString();

    await batch.deleteOne();

    const { onHand, allocated } = await recomputeStockFromBatches(itemId);
    await InventoryItemModel.findByIdAndUpdate(itemId, {
      onHand,
      allocated,
    }).exec();
  },

  // ─────────────────────────────────────────────
  // STOCK CONSUMPTION (FIFO by expiry)
  // ─────────────────────────────────────────────
  async consumeStock(input: ConsumeStockInput): Promise<InventoryItemDocument> {
    ensureObjectId(input.itemId, "itemId");
    if (input.quantity <= 0) {
      throw new InventoryServiceError("quantity must be > 0", 400);
    }

    const item = await InventoryItemModel.findById(input.itemId).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }

    if ((item.onHand ?? 0) < input.quantity) {
      throw new InventoryServiceError("Insufficient stock", 400);
    }

    let remaining = input.quantity;

    const batches = await InventoryBatchModel.find({
      itemId: input.itemId,
    })
      .sort({ expiryDate: 1, _id: 1 }) // earliest expiry first
      .exec();

    for (const batch of batches) {
      if (remaining <= 0) break;

      const availableInBatch = batch.quantity ?? 0;
      if (availableInBatch <= 0) continue;

      const consume = Math.min(availableInBatch, remaining);
      batch.quantity = availableInBatch - consume;
      remaining -= consume;
      await batch.save();
    }

    if (remaining > 0) {
      // Shouldn't happen if checks are correct, but safety:
      throw new InventoryServiceError(
        "Failed to consume full requested quantity",
        500,
      );
    }

    const { onHand, allocated } = await recomputeStockFromBatches(input.itemId);
    item.onHand = onHand;
    item.allocated = allocated;
    await item.save();

    // Later you can log StockMovement here
    return item;
  },

  // ─────────────────────────────────────────────
  // STOCK CONSUMPTION (BULK, FIFO by expiry)
  // ─────────────────────────────────────────────
  async bulkConsumeStock(
    input: BulkConsumeStockInput,
  ): Promise<InventoryItemDocument[]> {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new InventoryServiceError("items must be a non-empty array", 400);
    }

    const results: InventoryItemDocument[] = [];
    for (const itemInput of input.items) {
      results.push(await this.consumeStock(itemInput));
    }

    return results;
  },

  async getInventoryTurnoverByItem(params: {
    organisationId: string;
    from?: Date; // default: 12 months ago
    to?: Date; // default: now
  }) {
    const { organisationId } = params;

    const to = params.to ?? new Date();
    const from = params.from ?? dayjs(to).subtract(12, "month").toDate();

    // 1️⃣ Fetch all active items for org
    const items = await InventoryItemModel.find({
      organisationId,
      status: { $ne: "DELETED" },
    }).exec();

    if (!items.length) return [];

    const itemIds = items.map((i) => i._id.toString());

    // 2️⃣ Fetch stock movements (PURCHASE ONLY)
    const movements = await StockMovementModel.find({
      organisationId,
      itemId: { $in: itemIds },
      reason: "PURCHASE",
      change: { $gt: 0 },
      createdAt: { $gte: from, $lte: to },
    }).lean();

    // Group purchases by item
    const purchasesByItem = new Map<string, number>();
    for (const m of movements) {
      const key = m.itemId.toString();
      purchasesByItem.set(key, (purchasesByItem.get(key) ?? 0) + m.change);
    }

    const results: Array<{
      itemId: string;
      name: string;
      category: string;
      subCategory?: string;

      beginningInventory: number;
      endingInventory: number;
      avgInventory: number;
      totalPurchased: number;
      turnsPerYear: number;
      daysOnShelf: number;
      status: string;
    }> = [];

    // 3️⃣ Compute inventory snapshots per item
    for (const item of items) {
      const itemId = item._id.toString();

      // Ending inventory = current onHand
      const endingInventory = item.onHand ?? 0;

      // Beginning inventory = ending - net purchases + net consumption
      // Instead of guessing, we reconstruct from batches at `from`
      const batchesAtStart = await InventoryBatchModel.aggregate<{
        qty: number;
      }>([
        {
          $match: {
            organisationId,
            itemId: itemId,
            createdAt: { $lte: from },
          },
        },
        {
          $group: {
            _id: null,
            qty: { $sum: "$quantity" },
          },
        },
      ]);

      const beginningInventory = batchesAtStart[0]?.qty ?? 0;

      const avgInventory = (beginningInventory + endingInventory) / 2;

      const totalPurchased = purchasesByItem.get(itemId) ?? 0;

      const turnsPerYear = avgInventory > 0 ? totalPurchased / avgInventory : 0;

      const daysOnShelf = turnsPerYear > 0 ? 365 / turnsPerYear : 0;

      results.push({
        itemId,
        name: item.name,
        category: item.category,
        subCategory: item.subCategory,

        beginningInventory,
        endingInventory,
        avgInventory,
        totalPurchased,
        turnsPerYear: Number(turnsPerYear.toFixed(2)),
        daysOnShelf: Number(daysOnShelf.toFixed(1)),
        status: computeTurnoverStatus(turnsPerYear),
      });
    }

    return results;
  },
};

export const InventoryAdjustmentService = {
  async adjustStock(input: {
    itemId: string;
    newOnHand: number;
    reason: string; // "MANUAL_ADJUSTMENT", etc.
    userId?: string;
  }): Promise<InventoryItemDocument> {
    ensureObjectId(input.itemId);

    const item = await InventoryItemModel.findById(input.itemId);
    if (!item) throw new InventoryServiceError("Item not found", 404);

    const delta = input.newOnHand - (item.onHand ?? 0);

    // Positive delta = increase (create virtual adjustment batch)
    // Negative delta = decrease (consume FIFO batches)
    if (delta > 0) {
      await InventoryBatchModel.create({
        itemId: item._id.toString(),
        quantity: delta,
        allocatedQuantity: 0,
        notes: "Manual adjustment increase",
      });

      await logMovement({
        itemId: input.itemId,
        change: delta,
        reason: input.reason,
        userId: input.userId,
      });
    } else if (delta < 0) {
      // consume stock using FIFO logic
      let remaining = Math.abs(delta);
      const batches = await InventoryBatchModel.find({ itemId: item._id })
        .sort({ expiryDate: 1 })
        .exec();

      for (const batch of batches) {
        if (remaining <= 0) break;
        const available = batch.quantity;
        const consume = Math.min(available, remaining);
        batch.quantity -= consume;
        remaining -= consume;
        await batch.save();

        await logMovement({
          itemId: input.itemId,
          batchId: batch._id.toString(),
          change: -consume,
          reason: input.reason,
          userId: input.userId,
        });
      }

      if (remaining > 0) {
        throw new InventoryServiceError(
          "Insufficient stock for adjustment",
          400,
        );
      }
    }

    // Recompute
    const batches = await InventoryBatchModel.find({ itemId: item._id });
    let onHand = 0;
    let allocated = 0;
    batches.forEach((b) => {
      onHand += b.quantity;
      allocated += b.allocated ?? 0;
    });

    item.onHand = onHand;
    item.allocated = allocated;
    await item.save();

    return item;
  },
};

export const InventoryAllocationService = {
  async allocateStock({
    itemId,
    quantity,
    referenceId,
  }: {
    itemId: string;
    quantity: number;
    referenceId: string; // appointment ID, grooming ID, boarding ID
  }): Promise<InventoryItemDocument> {
    ensureObjectId(itemId);

    const item = await InventoryItemModel.findById(itemId);
    if (!item) throw new InventoryServiceError("Item not found", 404);

    if (item.onHand - item.allocated < quantity) {
      throw new InventoryServiceError("Not enough unallocated stock", 400);
    }

    item.allocated += quantity;
    await item.save();

    await logMovement({
      itemId,
      change: 0,
      reason: "ALLOCATED",
      referenceId,
    });

    return item;
  },

  async releaseAllocatedStock({
    itemId,
    quantity,
    referenceId,
  }: {
    itemId: string;
    quantity: number;
    referenceId: string;
  }): Promise<InventoryItemDocument> {
    ensureObjectId(itemId);

    const item = await InventoryItemModel.findById(itemId);
    if (!item) throw new InventoryServiceError("Item not found", 404);

    item.allocated = Math.max(0, item.allocated - quantity);
    await item.save();

    await logMovement({
      itemId,
      change: 0,
      reason: "UNALLOCATED",
      referenceId,
    });

    return item;
  },
};

export const InventoryVendorService = {
  async createVendor(input: {
    organisationId: string;
    name: string;
    brand?: string;
    vendorType?: string;
    licenseNumber?: string;
    paymentTerms?: string;
    deliveryFrequency?: string;
    leadTimeDays?: number;
    contactInfo?: InventoryVendorMongo["contactInfo"];
  }): Promise<InventoryVendorDocument> {
    if (!input.organisationId)
      throw new InventoryServiceError("organisationId required");

    return InventoryVendorModel.create(input);
  },

  async updateVendor(
    vendorId: string,
    updates: Partial<InventoryVendorDocument>,
  ) {
    ensureObjectId(vendorId);

    const vendor = await InventoryVendorModel.findById(vendorId);
    if (!vendor) throw new InventoryServiceError("Vendor not found", 404);

    Object.assign(vendor, updates);
    await vendor.save();
    return vendor;
  },

  async listVendors(organisationId: string) {
    return InventoryVendorModel.find({ organisationId }).exec();
  },

  async getVendor(vendorId: string) {
    ensureObjectId(vendorId);
    return InventoryVendorModel.findById(vendorId);
  },

  async deleteVendor(vendorId: string) {
    ensureObjectId(vendorId);
    await InventoryVendorModel.findByIdAndDelete(vendorId);
  },
};

export const InventoryMetaFieldService = {
  async createField(input: {
    businessType: string;
    fieldKey: string;
    label: string;
    values: string[];
  }): Promise<InventoryMetaFieldDocument> {
    return InventoryMetaFieldModel.create(input);
  },

  async updateField(
    fieldId: string,
    updates: Partial<InventoryMetaFieldDocument>,
  ) {
    ensureObjectId(fieldId);

    const field = await InventoryMetaFieldModel.findById(fieldId);
    if (!field) throw new InventoryServiceError("Meta field not found", 404);

    Object.assign(field, updates);
    await field.save();
    return field;
  },

  async deleteField(fieldId: string) {
    ensureObjectId(fieldId);
    await InventoryMetaFieldModel.findByIdAndDelete(fieldId);
  },

  async listFields(businessType: string) {
    return InventoryMetaFieldModel.find({ businessType }).exec();
  },
};

export const InventoryAlertService = {
  async getLowStockItems(organisationId: string) {
    const items = await InventoryItemModel.find({
      organisationId,
    });

    return items.filter((i) => {
      if (!i.reorderLevel) return false;
      return (i.onHand ?? 0) <= i.reorderLevel;
    });
  },

  async getExpiringItems(organisationId: string, days = 7) {
    const now = dayjs();
    const threshold = now.add(days, "day").toDate();

    return InventoryBatchModel.find({
      organisationId,
      expiryDate: { $lte: threshold },
    });
  },
};
