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
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { getOrgBillingCurrency } from "src/utils/billing";
import {
  InventoryBusinessType,
  InventoryItemStatus,
  Prisma,
} from "@prisma/client";
import { isReadFromPostgres } from "src/config/read-switch";

// Make sure this matches your schema's BusinessType
export type BusinessType =
  | "HOSPITAL"
  | "GROOMING"
  | "BOARDING"
  | "BREEDING"
  | "GENERAL";

export type InventoryStatus = "ACTIVE" | "HIDDEN" | "DELETED";
type InventoryStatusFilter =
  | InventoryStatus
  | { $in: InventoryStatus[] }
  | { $ne: InventoryStatus };

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

const BUSINESS_TYPES = new Set<BusinessType>([
  "HOSPITAL",
  "GROOMING",
  "BOARDING",
  "BREEDING",
  "GENERAL",
]);

const INVENTORY_STATUSES = new Set<InventoryStatus>([
  "ACTIVE",
  "HIDDEN",
  "DELETED",
]);

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const ensureNonEmptyString = (value: unknown, field: string): string => {
  const trimmed = asNonEmptyString(value);
  if (!trimmed) {
    throw new InventoryServiceError(`Invalid ${field}`, 400);
  }
  return trimmed;
};

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

const sanitizeBusinessType = (value: unknown): BusinessType | undefined =>
  typeof value === "string" && BUSINESS_TYPES.has(value as BusinessType)
    ? (value as BusinessType)
    : undefined;

const sanitizeStatus = (value: unknown): InventoryStatus | undefined =>
  typeof value === "string" && INVENTORY_STATUSES.has(value as InventoryStatus)
    ? (value as InventoryStatus)
    : undefined;

const sanitizeStatusList = (value: unknown): InventoryStatus[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter(
    (status): status is InventoryStatus =>
      typeof status === "string" &&
      INVENTORY_STATUSES.has(status as InventoryStatus),
  );
  return filtered.length ? filtered : undefined;
};

const sanitizePositiveNumber = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value > 0 ? value : undefined;
};

const escapeRegex = (value: string) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const toObjectId = (value: string) =>
  Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value;

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

const applyOptionalBusinessType = (
  query: FilterQuery<InventoryItemMongo>,
  value: unknown,
) => {
  if (value === undefined) return;
  const businessType = sanitizeBusinessType(value);
  if (!businessType) {
    throw new InventoryServiceError("Invalid businessType", 400);
  }
  query.businessType = businessType;
};

const applyOptionalStringFilter = (
  query: FilterQuery<InventoryItemMongo>,
  value: unknown,
  fieldName: "category" | "subCategory",
) => {
  if (value === undefined) return;
  const fieldValue = asNonEmptyString(value);
  if (!fieldValue) {
    throw new InventoryServiceError(`Invalid ${fieldName}`, 400);
  }
  query[fieldName] = fieldValue;
};

const resolveStatusFilter = (
  status: ListInventoryFilter["status"],
): { status: InventoryStatusFilter; returnEmpty: boolean } => {
  if (status === undefined) {
    return { status: { $ne: "DELETED" }, returnEmpty: false };
  }
  if (Array.isArray(status)) {
    const statusList = sanitizeStatusList(status);
    if (!statusList) {
      if (status.length === 0) {
        return { status: { $in: [] as InventoryStatus[] }, returnEmpty: true };
      }
      throw new InventoryServiceError("Invalid status", 400);
    }
    return { status: { $in: statusList }, returnEmpty: false };
  }
  const single = sanitizeStatus(status);
  if (!single) {
    throw new InventoryServiceError("Invalid status", 400);
  }
  return { status: single, returnEmpty: false };
};

const applySearchFilter = (
  query: FilterQuery<InventoryItemMongo>,
  search: ListInventoryFilter["search"],
) => {
  if (!search) return;
  const s = asNonEmptyString(search);
  if (!s) return;
  const safe = escapeRegex(s);
  query.$or = [
    { name: { $regex: safe, $options: "i" } },
    { sku: { $regex: safe, $options: "i" } },
    { description: { $regex: safe, $options: "i" } },
  ];
};

const groupBatchesByItem = (batches: InventoryBatchDocument[]) => {
  const batchesByItem = new Map<string, InventoryBatchDocument[]>();
  for (const b of batches) {
    const key = b.itemId.toString();
    if (!batchesByItem.has(key)) batchesByItem.set(key, []);
    batchesByItem.get(key)!.push(b);
  }
  return batchesByItem;
};

const getNearestExpiry = (batches: InventoryBatchDocument[]) => {
  let nearestExpiry: Date | null = null;
  for (const b of batches) {
    if (!b.expiryDate) continue;
    if (!nearestExpiry || b.expiryDate < nearestExpiry) {
      nearestExpiry = b.expiryDate;
    }
  }
  return nearestExpiry;
};

const shouldIncludeItem = (args: {
  filter: ListInventoryFilter;
  stockHealth: StockHealthStatus;
  expiringWithinDays?: number;
}) => {
  const { filter, stockHealth, expiringWithinDays } = args;
  if (filter.lowStockOnly && stockHealth !== "LOW_STOCK") return false;
  if (filter.expiredOnly && stockHealth !== "EXPIRED") return false;
  if (
    expiringWithinDays &&
    !(stockHealth === "EXPIRING_SOON" || stockHealth === "EXPIRED")
  ) {
    return false;
  }
  return true;
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
  if (isReadFromPostgres()) {
    const batches = await prisma.inventoryBatch.findMany({
      where: { itemId },
    });

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
  }

  const safeItemId = ensureObjectId(itemId, "itemId");
  const batches = await InventoryBatchModel.find({
    itemId: safeItemId,
  }).lean();

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
const ensureObjectId = (id: string, fieldName = "id"): string => {
  if (isReadFromPostgres()) {
    return ensureNonEmptyString(id, fieldName);
  }
  if (!Types.ObjectId.isValid(id)) {
    throw new InventoryServiceError(`Invalid ${fieldName}`, 400);
  }
  return id;
};

/**
 * HELPER: log stock movment
 */
const logMovement = async (payload: StockMovementInput) => {
  if (isReadFromPostgres()) {
    await prisma.inventoryStockMovement.create({
      data: {
        itemId: payload.itemId ?? undefined,
        batchId: payload.batchId ?? undefined,
        change: payload.change ?? undefined,
        reason: payload.reason ?? undefined,
        referenceId: payload.referenceId ?? undefined,
        userId: payload.userId ?? undefined,
        createdAt: new Date(),
      },
    });
    return;
  }

  const doc = await StockMovementModel.create({
    ...payload,
    createdAt: new Date(),
  });

  if (shouldDualWrite) {
    try {
      await prisma.inventoryStockMovement.create({
        data: {
          id: doc._id.toString(),
          itemId: doc.itemId ?? undefined,
          batchId: doc.batchId ?? undefined,
          change: doc.change ?? undefined,
          reason: doc.reason ?? undefined,
          referenceId: doc.referenceId ?? undefined,
          userId: doc.userId ?? undefined,
          createdAt: doc.createdAt ?? new Date(),
        },
      });
    } catch (err) {
      handleDualWriteError("InventoryStockMovement", err);
    }
  }
};

const computeTurnoverStatus = (
  turnsPerYear: number,
): InventoryTurnoverStatus => {
  if (turnsPerYear >= 12) return "EXCELLENT";
  if (turnsPerYear >= 6) return "HEALTHY";
  if (turnsPerYear >= 3) return "MODERATE";
  return "LOW";
};

const toPrismaInventoryItemData = (doc: InventoryItemDocument) => {
  const obj = doc.toObject() as InventoryItemMongo & {
    _id: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    organisationId: obj.organisationId,
    businessType: obj.businessType as InventoryBusinessType,
    name: obj.name,
    sku: obj.sku ?? undefined,
    category: obj.category,
    subCategory: obj.subCategory ?? undefined,
    description: obj.description ?? undefined,
    imageUrl: obj.imageUrl ?? undefined,
    attributes: (obj.attributes ?? {}) as unknown as Prisma.InputJsonValue,
    onHand: obj.onHand ?? 0,
    allocated: obj.allocated ?? 0,
    reorderLevel: obj.reorderLevel ?? undefined,
    unitCost: obj.unitCost ?? undefined,
    sellingPrice: obj.sellingPrice ?? undefined,
    currency: obj.currency ?? undefined,
    vendorId: obj.vendorId ?? undefined,
    status: obj.status as InventoryItemStatus,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncInventoryItemToPostgres = async (doc: InventoryItemDocument) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaInventoryItemData(doc);
    await prisma.inventoryItem.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("InventoryItem", err);
  }
};

const syncInventoryBatchToPostgres = async (doc: InventoryBatchDocument) => {
  if (!shouldDualWrite) return;
  try {
    await prisma.inventoryBatch.upsert({
      where: { id: doc._id.toString() },
      create: {
        id: doc._id.toString(),
        itemId: doc.itemId,
        organisationId: doc.organisationId,
        batchNumber: doc.batchNumber ?? undefined,
        lotNumber: doc.lotNumber ?? undefined,
        regulatoryTrackingId: doc.regulatoryTrackingId ?? undefined,
        manufactureDate: doc.manufactureDate ?? undefined,
        expiryDate: doc.expiryDate ?? undefined,
        minShelfLifeAlertDate: doc.minShelfLifeAlertDate ?? undefined,
        quantity: doc.quantity ?? 0,
        allocated: doc.allocated ?? 0,
        createdAt: doc.createdAt ?? undefined,
        updatedAt: doc.updatedAt ?? undefined,
      },
      update: {
        batchNumber: doc.batchNumber ?? undefined,
        lotNumber: doc.lotNumber ?? undefined,
        regulatoryTrackingId: doc.regulatoryTrackingId ?? undefined,
        manufactureDate: doc.manufactureDate ?? undefined,
        expiryDate: doc.expiryDate ?? undefined,
        minShelfLifeAlertDate: doc.minShelfLifeAlertDate ?? undefined,
        quantity: doc.quantity ?? 0,
        allocated: doc.allocated ?? 0,
        updatedAt: doc.updatedAt ?? undefined,
      },
    });
  } catch (err) {
    handleDualWriteError("InventoryBatch", err);
  }
};

const syncInventoryVendorToPostgres = async (doc: InventoryVendorDocument) => {
  if (!shouldDualWrite) return;
  try {
    await prisma.inventoryVendor.upsert({
      where: { id: doc._id.toString() },
      create: {
        id: doc._id.toString(),
        organisationId: doc.organisationId,
        name: doc.name,
        brand: doc.brand ?? undefined,
        vendorType: doc.vendorType ?? undefined,
        licenseNumber: doc.licenseNumber ?? undefined,
        paymentTerms: doc.paymentTerms ?? undefined,
        deliveryFrequency: doc.deliveryFrequency ?? undefined,
        leadTimeDays: doc.leadTimeDays ?? undefined,
        contactInfo: (doc.contactInfo ??
          undefined) as unknown as Prisma.InputJsonValue,
        createdAt: doc.createdAt ?? undefined,
        updatedAt: doc.updatedAt ?? undefined,
      },
      update: {
        name: doc.name,
        brand: doc.brand ?? undefined,
        vendorType: doc.vendorType ?? undefined,
        licenseNumber: doc.licenseNumber ?? undefined,
        paymentTerms: doc.paymentTerms ?? undefined,
        deliveryFrequency: doc.deliveryFrequency ?? undefined,
        leadTimeDays: doc.leadTimeDays ?? undefined,
        contactInfo: (doc.contactInfo ??
          undefined) as unknown as Prisma.InputJsonValue,
        updatedAt: doc.updatedAt ?? undefined,
      },
    });
  } catch (err) {
    handleDualWriteError("InventoryVendor", err);
  }
};

const syncInventoryMetaFieldToPostgres = async (
  doc: InventoryMetaFieldDocument,
) => {
  if (!shouldDualWrite) return;
  try {
    await prisma.inventoryMetaField.upsert({
      where: {
        businessType_fieldKey: {
          businessType: doc.businessType,
          fieldKey: doc.fieldKey,
        },
      },
      create: {
        id: doc._id.toString(),
        businessType: doc.businessType,
        fieldKey: doc.fieldKey,
        label: doc.label,
        values: doc.values ?? [],
        createdAt: doc.createdAt ?? undefined,
        updatedAt: doc.updatedAt ?? undefined,
      },
      update: {
        label: doc.label,
        values: doc.values ?? [],
        updatedAt: doc.updatedAt ?? undefined,
      },
    });
  } catch (err) {
    handleDualWriteError("InventoryMetaField", err);
  }
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

    const organisationId = ensureNonEmptyString(
      input.organisationId,
      "organisationId",
    );
    const businessType = sanitizeBusinessType(input.businessType);
    if (!businessType) {
      throw new InventoryServiceError("Invalid businessType", 400);
    }

    const currency = await getOrgBillingCurrency(organisationId);

    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.create({
        data: {
          organisationId,
          businessType: businessType as InventoryBusinessType,
          name: input.name,
          sku: input.sku ?? undefined,
          category: input.category,
          subCategory: input.subCategory ?? undefined,
          description: input.description ?? undefined,
          imageUrl: input.imageUrl ?? undefined,
          attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
          unitCost: input.unitCost ?? undefined,
          sellingPrice: input.sellingPrice ?? undefined,
          currency,
          reorderLevel: input.reorderLevel ?? undefined,
          vendorId: input.vendorId ?? undefined,
          onHand: input.initialOnHand ?? 0,
          allocated: input.initialAllocated ?? 0,
          status: (input.status ?? "ACTIVE") as InventoryItemStatus,
        },
      });

      if (input.batches?.length) {
        await prisma.inventoryBatch.createMany({
          data: input.batches.map((b) => ({
            itemId: item.id,
            organisationId: item.organisationId,
            batchNumber: b.batchNumber ?? undefined,
            lotNumber: b.lotNumber ?? undefined,
            regulatoryTrackingId: b.regulatoryTrackingId ?? undefined,
            manufactureDate: b.manufactureDate ?? undefined,
            expiryDate: b.expiryDate ?? undefined,
            minShelfLifeAlertDate: b.minShelfLifeAlertDate ?? undefined,
            quantity: b.quantity,
            allocated: b.allocated ?? 0,
          })),
        });

        const { onHand, allocated } = await recomputeStockFromBatches(item.id);
        await prisma.inventoryItem.update({
          where: { id: item.id },
          data: { onHand, allocated },
        });
      }

      const batches = await prisma.inventoryBatch.findMany({
        where: { itemId: item.id, organisationId: item.organisationId },
        orderBy: { expiryDate: "asc" },
      });

      return {
        item: {
          ...item,
          _id: toObjectId(item.id),
        } as unknown as InventoryItemDocument,
        batches: batches.map((batch) => ({
          ...batch,
          _id: toObjectId(batch.id),
        })) as unknown as InventoryBatchDocument[],
      };
    }

    // 1. Create item with basic data (onHand will be recomputed if batches)
    const item = await InventoryItemModel.create({
      organisationId,
      businessType,

      name: input.name,
      sku: input.sku,
      category: input.category,
      subCategory: input.subCategory,

      description: input.description,
      imageUrl: input.imageUrl,

      attributes: input.attributes ?? {},

      unitCost: input.unitCost ?? undefined,
      sellingPrice: input.sellingPrice ?? undefined,
      currency,
      reorderLevel: input.reorderLevel ?? undefined,

      vendorId: input.vendorId ?? undefined,

      onHand: input.initialOnHand ?? 0,
      allocated: input.initialAllocated ?? 0,

      status: input.status ?? "ACTIVE",
    });
    await syncInventoryItemToPostgres(item);

    // 2. If batches were provided, insert them and recompute stock
    if (input.batches?.length) {
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

      const createdBatches = await InventoryBatchModel.insertMany(payloads);
      if (shouldDualWrite && createdBatches.length) {
        try {
          await prisma.inventoryBatch.createMany({
            data: createdBatches.map((doc) => ({
              id: doc._id.toString(),
              itemId: doc.itemId,
              organisationId: doc.organisationId,
              batchNumber: doc.batchNumber ?? undefined,
              lotNumber: doc.lotNumber ?? undefined,
              regulatoryTrackingId: doc.regulatoryTrackingId ?? undefined,
              manufactureDate: doc.manufactureDate ?? undefined,
              expiryDate: doc.expiryDate ?? undefined,
              minShelfLifeAlertDate: doc.minShelfLifeAlertDate ?? undefined,
              quantity: doc.quantity ?? 0,
              allocated: doc.allocated ?? 0,
              createdAt: doc.createdAt ?? undefined,
              updatedAt: doc.updatedAt ?? undefined,
            })),
          });
        } catch (err) {
          handleDualWriteError("InventoryBatch bulk", err);
        }
      }

      const { onHand, allocated } = await recomputeStockFromBatches(
        item._id.toString(),
      );
      item.onHand = onHand;
      item.allocated = allocated;
      await item.save();
      await syncInventoryItemToPostgres(item);
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

    if (isReadFromPostgres()) {
      const existing = await prisma.inventoryItem.findFirst({
        where: { id: itemId },
      });
      if (!existing) {
        throw new InventoryServiceError("Inventory item not found", 404);
      }

      const data: Prisma.InventoryItemUpdateInput = {};

      if (input.name !== undefined) data.name = input.name;
      if (input.sku !== undefined) data.sku = input.sku ?? null;
      if (input.category !== undefined) data.category = input.category;
      if (input.subCategory !== undefined)
        data.subCategory = input.subCategory ?? null;
      if (input.description !== undefined)
        data.description = input.description ?? null;
      if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl ?? null;
      if (input.attributes !== undefined)
        data.attributes = input.attributes as Prisma.InputJsonValue;

      if (input.unitCost !== undefined)
        data.unitCost = input.unitCost === null ? null : input.unitCost;
      if (input.sellingPrice !== undefined)
        data.sellingPrice =
          input.sellingPrice === null ? null : input.sellingPrice;
      if (input.currency !== undefined)
        data.currency = await getOrgBillingCurrency(existing.organisationId);
      if (input.reorderLevel !== undefined)
        data.reorderLevel =
          input.reorderLevel === null ? null : input.reorderLevel;
      if (input.vendorId !== undefined)
        data.vendorId = input.vendorId === null ? null : input.vendorId;
      if (input.status !== undefined)
        data.status = input.status as InventoryItemStatus;

      const updated = await prisma.inventoryItem.update({
        where: { id: itemId },
        data,
      });

      const batches = await prisma.inventoryBatch.findMany({
        where: { itemId, organisationId: updated.organisationId },
        orderBy: { expiryDate: "asc" },
      });

      return {
        item: {
          ...updated,
          _id: toObjectId(updated.id),
        } as unknown as InventoryItemDocument,
        batches: batches.map((batch) => ({
          ...batch,
          _id: toObjectId(batch.id),
        })) as unknown as InventoryBatchDocument[],
      };
    }

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
      item.currency = await getOrgBillingCurrency(
        item.organisationId.toString(),
      );
    if (input.reorderLevel !== undefined)
      item.reorderLevel = input.reorderLevel ?? undefined;

    if (input.vendorId !== undefined)
      item.vendorId = input.vendorId ?? undefined;

    if (input.status !== undefined) item.status = input.status;

    await item.save();
    await syncInventoryItemToPostgres(item);

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
    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { status: "HIDDEN" },
      });
      return {
        ...item,
        _id: toObjectId(item.id),
      } as unknown as InventoryItemDocument;
    }
    const item = await InventoryItemModel.findById(itemId).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }
    item.status = "HIDDEN";
    await item.save();
    await syncInventoryItemToPostgres(item);
    return item;
  },

  async archiveItem(itemId: string): Promise<InventoryItemDocument> {
    ensureObjectId(itemId, "itemId");
    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { status: "DELETED" },
      });
      return {
        ...item,
        _id: toObjectId(item.id),
      } as unknown as InventoryItemDocument;
    }
    const item = await InventoryItemModel.findById(itemId).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }
    item.status = "DELETED";
    await item.save();
    await syncInventoryItemToPostgres(item);
    return item;
  },

  async activeItem(itemId: string): Promise<InventoryItemDocument> {
    ensureObjectId(itemId, "itemId");
    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { status: "ACTIVE" },
      });
      return {
        ...item,
        _id: toObjectId(item.id),
      } as unknown as InventoryItemDocument;
    }
    const item = await InventoryItemModel.findById(itemId).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }
    item.status = "ACTIVE";
    await item.save();
    await syncInventoryItemToPostgres(item);
    return item;
  },

  // ─────────────────────────────────────────────
  // LIST ITEMS (table view)
  // ─────────────────────────────────────────────
  async listItems(filter: ListInventoryFilter): Promise<InventoryListItem[]> {
    const query: FilterQuery<InventoryItemMongo> = {
      organisationId: ensureNonEmptyString(
        filter.organisationId,
        "organisationId",
      ),
    };
    const expiringWithinDays = sanitizePositiveNumber(
      filter.expiringWithinDays,
    );
    applyOptionalBusinessType(query, filter.businessType);
    applyOptionalStringFilter(query, filter.category, "category");
    applyOptionalStringFilter(query, filter.subCategory, "subCategory");
    const statusFilter = resolveStatusFilter(filter.status);
    if (statusFilter.returnEmpty) return [];
    query.status = statusFilter.status;
    applySearchFilter(query, filter.search);

    if (isReadFromPostgres()) {
      const where: Prisma.InventoryItemWhereInput = {
        organisationId: query.organisationId as string,
      };

      if (query.businessType) {
        where.businessType = query.businessType as InventoryBusinessType;
      }
      if (query.category) where.category = query.category as string;
      if (query.subCategory) where.subCategory = query.subCategory as string;
      if (query.status) {
        if (typeof query.status === "string") {
          where.status = query.status as InventoryItemStatus;
        } else if (typeof query.status === "object" && "$in" in query.status) {
          where.status = {
            in: (query.status as { $in: InventoryStatus[] })
              .$in as InventoryItemStatus[],
          };
        } else if (typeof query.status === "object" && "$ne" in query.status) {
          where.status = {
            not: (query.status as { $ne: InventoryStatus })
              .$ne as InventoryItemStatus,
          };
        }
      }

      if (query.$or) {
        where.OR = (query.$or as Array<Record<string, unknown>>).map(
          (entry) => {
            const key = Object.keys(entry)[0];
            const value = entry[key] as
              | { $regex?: string; $options?: string }
              | RegExp;
            const pattern =
              value instanceof RegExp
                ? value.source
                : typeof value === "object" && value.$regex
                  ? String(value.$regex)
                  : "";
            return pattern
              ? { [key]: { contains: pattern, mode: "insensitive" } }
              : {};
          },
        ) as Prisma.InventoryItemWhereInput[];
      }

      const items = await prisma.inventoryItem.findMany({
        where,
        orderBy: { name: "asc" },
      });

      const itemIds = items.map((i) => i.id);
      const batches = await prisma.inventoryBatch.findMany({
        where: { itemId: { in: itemIds } },
      });

      const mappedBatches = batches.map((batch) => ({
        ...batch,
        _id: toObjectId(batch.id),
      })) as unknown as InventoryBatchDocument[];

      const batchesByItem = groupBatchesByItem(mappedBatches);

      const result: InventoryListItem[] = [];

      for (const item of items) {
        const itemBatches = batchesByItem.get(item.id) ?? [];
        const nearestExpiry = getNearestExpiry(itemBatches);

        const stockHealth = computeStockHealthStatus({
          onHand: item.onHand ?? 0,
          reorderLevel: item.reorderLevel ?? null,
          nearestExpiry,
          soonThresholdDays: expiringWithinDays ?? 7,
        });

        if (!shouldIncludeItem({ filter, stockHealth, expiringWithinDays })) {
          continue;
        }

        const itemObject = {
          ...item,
          _id: toObjectId(item.id),
        } as unknown as InventoryItemMongo & { _id: Types.ObjectId };

        result.push({ ...itemObject, stockHealth, batches: itemBatches });
      }

      return result;
    }

    const items = await InventoryItemModel.find(query).sort({ name: 1 }).exec();

    const itemIds = items.map((i) => i._id.toString());
    const batches = await InventoryBatchModel.find({
      itemId: { $in: itemIds },
    }).exec();

    const batchesByItem = groupBatchesByItem(batches);

    const result: InventoryListItem[] = [];

    for (const item of items) {
      const itemBatches = batchesByItem.get(item._id.toString()) ?? [];
      const nearestExpiry = getNearestExpiry(itemBatches);

      const stockHealth = computeStockHealthStatus({
        onHand: item.onHand ?? 0,
        reorderLevel: item.reorderLevel ?? null,
        nearestExpiry,
        soonThresholdDays: expiringWithinDays ?? 7,
      });

      // Apply extra filters
      if (!shouldIncludeItem({ filter, stockHealth, expiringWithinDays })) {
        continue;
      }

      const itemObject = item.toObject<InventoryItemMongo>();
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
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );

    if (isReadFromPostgres()) {
      const [item, batches] = await Promise.all([
        prisma.inventoryItem.findFirst({ where: { id: itemId } }),
        prisma.inventoryBatch.findMany({
          where: { itemId, organisationId: safeOrganisationId },
          orderBy: { expiryDate: "asc" },
        }),
      ]);

      if (!item) {
        throw new InventoryServiceError("Inventory item not found", 404);
      }

      return {
        item: {
          ...item,
          _id: toObjectId(item.id),
        } as unknown as InventoryItemDocument,
        batches: batches.map((batch) => ({
          ...batch,
          _id: toObjectId(batch.id),
        })) as unknown as InventoryBatchDocument[],
      };
    }

    const [item, batches] = await Promise.all([
      InventoryItemModel.findById(itemId).exec(),
      InventoryBatchModel.find({ itemId, organisationId: safeOrganisationId })
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

    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: itemId },
      });
      if (!item)
        throw new InventoryServiceError("Inventory item not found", 404);

      const batch = await prisma.inventoryBatch.create({
        data: {
          itemId,
          organisationId: item.organisationId,
          batchNumber: batchInput.batchNumber ?? undefined,
          lotNumber: batchInput.lotNumber ?? undefined,
          regulatoryTrackingId: batchInput.regulatoryTrackingId ?? undefined,
          manufactureDate: batchInput.manufactureDate ?? undefined,
          expiryDate: batchInput.expiryDate ?? undefined,
          minShelfLifeAlertDate: batchInput.minShelfLifeAlertDate ?? undefined,
          quantity: batchInput.quantity,
          allocated: batchInput.allocated ?? 0,
        },
      });

      const { onHand, allocated } = await recomputeStockFromBatches(itemId);
      await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { onHand, allocated },
      });

      return {
        ...batch,
        _id: toObjectId(batch.id),
      } as unknown as InventoryBatchDocument;
    }

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
    await syncInventoryBatchToPostgres(batch);

    const { onHand, allocated } = await recomputeStockFromBatches(itemId);
    item.onHand = onHand;
    item.allocated = allocated;
    await item.save();
    await syncInventoryItemToPostgres(item);

    return batch;
  },

  async updateBatch(
    batchId: string,
    input: Partial<InventoryBatchInput>,
  ): Promise<InventoryBatchDocument> {
    ensureObjectId(batchId, "batchId");

    if (isReadFromPostgres()) {
      const batch = await prisma.inventoryBatch.findFirst({
        where: { id: batchId },
      });
      if (!batch) {
        throw new InventoryServiceError("Batch not found", 404);
      }

      const data: Prisma.InventoryBatchUpdateInput = {};
      if (input.batchNumber !== undefined)
        data.batchNumber = input.batchNumber ?? null;
      if (input.lotNumber !== undefined)
        data.lotNumber = input.lotNumber ?? null;
      if (input.regulatoryTrackingId !== undefined)
        data.regulatoryTrackingId = input.regulatoryTrackingId ?? null;
      if (input.manufactureDate !== undefined)
        data.manufactureDate = input.manufactureDate ?? null;
      if (input.expiryDate !== undefined)
        data.expiryDate = input.expiryDate ?? null;
      if (input.minShelfLifeAlertDate !== undefined)
        data.minShelfLifeAlertDate = input.minShelfLifeAlertDate ?? null;
      if (input.quantity !== undefined) data.quantity = input.quantity;
      if (input.allocated !== undefined) data.allocated = input.allocated;

      const updated = await prisma.inventoryBatch.update({
        where: { id: batchId },
        data,
      });

      const { onHand, allocated } = await recomputeStockFromBatches(
        updated.itemId,
      );
      await prisma.inventoryItem.updateMany({
        where: { id: updated.itemId },
        data: { onHand, allocated },
      });

      return {
        ...updated,
        _id: toObjectId(updated.id),
      } as unknown as InventoryBatchDocument;
    }

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
    await syncInventoryBatchToPostgres(batch);

    // recompute stock
    const { onHand, allocated } = await recomputeStockFromBatches(
      batch.itemId.toString(),
    );
    await InventoryItemModel.findByIdAndUpdate(batch.itemId, {
      onHand,
      allocated,
    }).exec();
    if (shouldDualWrite) {
      try {
        await prisma.inventoryItem.updateMany({
          where: { id: batch.itemId.toString() },
          data: { onHand, allocated },
        });
      } catch (err) {
        handleDualWriteError("InventoryItem updateStock", err);
      }
    }

    return batch;
  },

  async deleteBatch(batchId: string): Promise<void> {
    ensureObjectId(batchId, "batchId");

    if (isReadFromPostgres()) {
      const batch = await prisma.inventoryBatch.findFirst({
        where: { id: batchId },
      });
      if (!batch) return;

      await prisma.inventoryBatch.deleteMany({
        where: { id: batchId },
      });

      const { onHand, allocated } = await recomputeStockFromBatches(
        batch.itemId,
      );
      await prisma.inventoryItem.updateMany({
        where: { id: batch.itemId },
        data: { onHand, allocated },
      });
      return;
    }

    const batch = await InventoryBatchModel.findById(batchId).exec();
    if (!batch) return;

    const itemId = batch.itemId.toString();

    await batch.deleteOne();
    if (shouldDualWrite) {
      try {
        await prisma.inventoryBatch.deleteMany({
          where: { id: batch._id.toString() },
        });
      } catch (err) {
        handleDualWriteError("InventoryBatch delete", err);
      }
    }

    const { onHand, allocated } = await recomputeStockFromBatches(itemId);
    await InventoryItemModel.findByIdAndUpdate(itemId, {
      onHand,
      allocated,
    }).exec();
    if (shouldDualWrite) {
      try {
        await prisma.inventoryItem.updateMany({
          where: { id: itemId },
          data: { onHand, allocated },
        });
      } catch (err) {
        handleDualWriteError("InventoryItem updateStock", err);
      }
    }
  },

  // ─────────────────────────────────────────────
  // STOCK CONSUMPTION (FIFO by expiry)
  // ─────────────────────────────────────────────
  async consumeStock(input: ConsumeStockInput): Promise<InventoryItemDocument> {
    const safeItemId = ensureObjectId(input.itemId, "itemId");
    if (input.quantity <= 0) {
      throw new InventoryServiceError("quantity must be > 0", 400);
    }

    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: safeItemId },
      });
      if (!item) {
        throw new InventoryServiceError("Inventory item not found", 404);
      }

      if ((item.onHand ?? 0) < input.quantity) {
        throw new InventoryServiceError("Insufficient stock", 400);
      }

      let remaining = input.quantity;
      const batches = await prisma.inventoryBatch.findMany({
        where: { itemId: safeItemId },
        orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
      });

      for (const batch of batches) {
        if (remaining <= 0) break;
        const availableInBatch = batch.quantity ?? 0;
        if (availableInBatch <= 0) continue;
        const consume = Math.min(availableInBatch, remaining);
        remaining -= consume;
        await prisma.inventoryBatch.update({
          where: { id: batch.id },
          data: { quantity: availableInBatch - consume },
        });
      }

      if (remaining > 0) {
        throw new InventoryServiceError(
          "Failed to consume full requested quantity",
          500,
        );
      }

      const { onHand, allocated } = await recomputeStockFromBatches(safeItemId);
      const updated = await prisma.inventoryItem.update({
        where: { id: safeItemId },
        data: { onHand, allocated },
      });

      return {
        ...updated,
        _id: toObjectId(updated.id),
      } as unknown as InventoryItemDocument;
    }

    const item = await InventoryItemModel.findById(safeItemId).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }

    if ((item.onHand ?? 0) < input.quantity) {
      throw new InventoryServiceError("Insufficient stock", 400);
    }

    let remaining = input.quantity;

    const batches = await InventoryBatchModel.find({
      itemId: safeItemId,
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
      await syncInventoryBatchToPostgres(batch);
    }

    if (remaining > 0) {
      // Shouldn't happen if checks are correct, but safety:
      throw new InventoryServiceError(
        "Failed to consume full requested quantity",
        500,
      );
    }

    const { onHand, allocated } = await recomputeStockFromBatches(safeItemId);
    item.onHand = onHand;
    item.allocated = allocated;
    await item.save();
    await syncInventoryItemToPostgres(item);

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
    const organisationId = ensureNonEmptyString(
      params.organisationId,
      "organisationId",
    );

    if (params.to && !isValidDate(params.to)) {
      throw new InventoryServiceError("Invalid to", 400);
    }
    if (params.from && !isValidDate(params.from)) {
      throw new InventoryServiceError("Invalid from", 400);
    }

    const to = params.to ?? new Date();
    const from = params.from ?? dayjs(to).subtract(12, "month").toDate();

    if (isReadFromPostgres()) {
      const items = await prisma.inventoryItem.findMany({
        where: { organisationId, status: { not: "DELETED" } },
      });

      if (!items.length) return [];

      const itemIds = items.map((i) => i.id);
      const movements = await prisma.inventoryStockMovement.findMany({
        where: {
          itemId: { in: itemIds },
          reason: "PURCHASE",
          change: { gt: 0 },
          createdAt: { gte: from, lte: to },
        },
      });

      const purchasesByItem = new Map<string, number>();
      for (const m of movements) {
        const key = m.itemId ?? "";
        if (!key) continue;
        purchasesByItem.set(
          key,
          (purchasesByItem.get(key) ?? 0) + (m.change ?? 0),
        );
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

      for (const item of items) {
        const endingInventory = item.onHand ?? 0;

        const batchesAtStart = await prisma.inventoryBatch.aggregate({
          where: {
            organisationId,
            itemId: item.id,
            createdAt: { lte: from },
          },
          _sum: { quantity: true },
        });

        const beginningInventory = batchesAtStart._sum.quantity ?? 0;
        const avgInventory = (beginningInventory + endingInventory) / 2;
        const totalPurchased = purchasesByItem.get(item.id) ?? 0;
        const turnsPerYear =
          avgInventory > 0 ? totalPurchased / avgInventory : 0;
        const daysOnShelf = turnsPerYear > 0 ? 365 / turnsPerYear : 0;

        results.push({
          itemId: item.id,
          name: item.name,
          category: item.category,
          subCategory: item.subCategory ?? undefined,
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
    }

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
    const safeItemId = ensureObjectId(input.itemId);

    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: safeItemId },
      });
      if (!item) throw new InventoryServiceError("Item not found", 404);

      const delta = input.newOnHand - (item.onHand ?? 0);

      if (delta > 0) {
        await prisma.inventoryBatch.create({
          data: {
            itemId: item.id,
            organisationId: item.organisationId,
            quantity: delta,
            allocated: 0,
          },
        });

        await logMovement({
          itemId: safeItemId,
          change: delta,
          reason: input.reason,
          userId: input.userId,
        });
      } else if (delta < 0) {
        let remaining = Math.abs(delta);
        const batches = await prisma.inventoryBatch.findMany({
          where: { itemId: item.id },
          orderBy: { expiryDate: "asc" },
        });

        for (const batch of batches) {
          if (remaining <= 0) break;
          const available = batch.quantity ?? 0;
          const consume = Math.min(available, remaining);
          remaining -= consume;
          await prisma.inventoryBatch.update({
            where: { id: batch.id },
            data: { quantity: available - consume },
          });

          await logMovement({
            itemId: input.itemId,
            batchId: batch.id,
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

      const { onHand, allocated } = await recomputeStockFromBatches(item.id);
      const updated = await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { onHand, allocated },
      });

      return {
        ...updated,
        _id: toObjectId(updated.id),
      } as unknown as InventoryItemDocument;
    }

    const item = await InventoryItemModel.findById(safeItemId);
    if (!item) throw new InventoryServiceError("Item not found", 404);

    const delta = input.newOnHand - (item.onHand ?? 0);

    // Positive delta = increase (create virtual adjustment batch)
    // Negative delta = decrease (consume FIFO batches)
    if (delta > 0) {
      const batch = await InventoryBatchModel.create({
        itemId: item._id.toString(),
        quantity: delta,
        allocatedQuantity: 0,
        notes: "Manual adjustment increase",
      });
      await syncInventoryBatchToPostgres(batch);

      await logMovement({
        itemId: safeItemId,
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
        await syncInventoryBatchToPostgres(batch);

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
    await syncInventoryItemToPostgres(item);

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

    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: itemId },
      });
      if (!item) throw new InventoryServiceError("Item not found", 404);

      if ((item.onHand ?? 0) - (item.allocated ?? 0) < quantity) {
        throw new InventoryServiceError("Not enough unallocated stock", 400);
      }

      const updated = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { allocated: (item.allocated ?? 0) + quantity },
      });

      await logMovement({
        itemId,
        change: 0,
        reason: "ALLOCATED",
        referenceId,
      });

      return {
        ...updated,
        _id: toObjectId(updated.id),
      } as unknown as InventoryItemDocument;
    }

    const item = await InventoryItemModel.findById(itemId);
    if (!item) throw new InventoryServiceError("Item not found", 404);

    if (item.onHand - item.allocated < quantity) {
      throw new InventoryServiceError("Not enough unallocated stock", 400);
    }

    item.allocated += quantity;
    await item.save();
    await syncInventoryItemToPostgres(item);

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

    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: itemId },
      });
      if (!item) throw new InventoryServiceError("Item not found", 404);

      const updated = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { allocated: Math.max(0, (item.allocated ?? 0) - quantity) },
      });

      await logMovement({
        itemId,
        change: 0,
        reason: "UNALLOCATED",
        referenceId,
      });

      return {
        ...updated,
        _id: toObjectId(updated.id),
      } as unknown as InventoryItemDocument;
    }

    const item = await InventoryItemModel.findById(itemId);
    if (!item) throw new InventoryServiceError("Item not found", 404);

    item.allocated = Math.max(0, item.allocated - quantity);
    await item.save();
    await syncInventoryItemToPostgres(item);

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

    const organisationId = ensureNonEmptyString(
      input.organisationId,
      "organisationId",
    );

    if (isReadFromPostgres()) {
      return prisma.inventoryVendor.create({
        data: {
          organisationId,
          name: input.name,
          brand: input.brand ?? undefined,
          vendorType: input.vendorType ?? undefined,
          licenseNumber: input.licenseNumber ?? undefined,
          paymentTerms: input.paymentTerms ?? undefined,
          deliveryFrequency: input.deliveryFrequency ?? undefined,
          leadTimeDays: input.leadTimeDays ?? undefined,
          contactInfo: (input.contactInfo ??
            undefined) as Prisma.InputJsonValue,
        },
      }) as unknown as InventoryVendorDocument;
    }

    const vendor = await InventoryVendorModel.create({
      ...input,
      organisationId,
    });
    await syncInventoryVendorToPostgres(vendor);
    return vendor;
  },

  async updateVendor(
    vendorId: string,
    updates: Partial<InventoryVendorDocument>,
  ) {
    ensureObjectId(vendorId);

    if (isReadFromPostgres()) {
      const updated = await prisma.inventoryVendor.update({
        where: { id: vendorId },
        data: {
          name: updates.name ?? undefined,
          brand: updates.brand ?? undefined,
          vendorType: updates.vendorType ?? undefined,
          licenseNumber: updates.licenseNumber ?? undefined,
          paymentTerms: updates.paymentTerms ?? undefined,
          deliveryFrequency: updates.deliveryFrequency ?? undefined,
          leadTimeDays: updates.leadTimeDays ?? undefined,
          contactInfo: (updates.contactInfo ??
            undefined) as Prisma.InputJsonValue,
        },
      });
      return updated as unknown as InventoryVendorDocument;
    }

    const vendor = await InventoryVendorModel.findById(vendorId);
    if (!vendor) throw new InventoryServiceError("Vendor not found", 404);

    Object.assign(vendor, updates);
    await vendor.save();
    await syncInventoryVendorToPostgres(vendor);
    return vendor;
  },

  async listVendors(organisationId: string) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    if (isReadFromPostgres()) {
      return prisma.inventoryVendor.findMany({
        where: { organisationId: safeOrganisationId },
        orderBy: { name: "asc" },
      });
    }
    return InventoryVendorModel.find({
      organisationId: safeOrganisationId,
    }).exec();
  },

  async getVendor(vendorId: string) {
    ensureObjectId(vendorId);
    if (isReadFromPostgres()) {
      return prisma.inventoryVendor.findFirst({
        where: { id: vendorId },
      });
    }
    return InventoryVendorModel.findById(vendorId);
  },

  async deleteVendor(vendorId: string) {
    ensureObjectId(vendorId);
    if (isReadFromPostgres()) {
      await prisma.inventoryVendor.deleteMany({ where: { id: vendorId } });
      return;
    }
    await InventoryVendorModel.findByIdAndDelete(vendorId);
    if (shouldDualWrite) {
      try {
        await prisma.inventoryVendor.deleteMany({ where: { id: vendorId } });
      } catch (err) {
        handleDualWriteError("InventoryVendor delete", err);
      }
    }
  },
};

export const InventoryMetaFieldService = {
  async createField(input: {
    businessType: string;
    fieldKey: string;
    label: string;
    values: string[];
  }): Promise<InventoryMetaFieldDocument> {
    const businessType = sanitizeBusinessType(input.businessType);
    if (!businessType) {
      throw new InventoryServiceError("Invalid businessType", 400);
    }

    if (isReadFromPostgres()) {
      return prisma.inventoryMetaField.create({
        data: {
          businessType,
          fieldKey: input.fieldKey,
          label: input.label,
          values: input.values ?? [],
        },
      }) as unknown as InventoryMetaFieldDocument;
    }

    const field = await InventoryMetaFieldModel.create({
      ...input,
      businessType,
    });
    await syncInventoryMetaFieldToPostgres(field);
    return field;
  },

  async updateField(
    fieldId: string,
    updates: Partial<InventoryMetaFieldDocument>,
  ) {
    ensureObjectId(fieldId);

    if (isReadFromPostgres()) {
      const updated = await prisma.inventoryMetaField.update({
        where: { id: fieldId },
        data: {
          label: updates.label ?? undefined,
          values: updates.values ?? undefined,
        },
      });
      return updated as unknown as InventoryMetaFieldDocument;
    }

    const field = await InventoryMetaFieldModel.findById(fieldId);
    if (!field) throw new InventoryServiceError("Meta field not found", 404);

    Object.assign(field, updates);
    await field.save();
    await syncInventoryMetaFieldToPostgres(field);
    return field;
  },

  async deleteField(fieldId: string) {
    ensureObjectId(fieldId);
    if (isReadFromPostgres()) {
      await prisma.inventoryMetaField.deleteMany({
        where: { id: fieldId },
      });
      return;
    }
    await InventoryMetaFieldModel.findByIdAndDelete(fieldId);
    if (shouldDualWrite) {
      try {
        await prisma.inventoryMetaField.deleteMany({
          where: { id: fieldId },
        });
      } catch (err) {
        handleDualWriteError("InventoryMetaField delete", err);
      }
    }
  },

  async listFields(businessType: string) {
    const safeBusinessType = sanitizeBusinessType(businessType);
    if (!safeBusinessType) {
      throw new InventoryServiceError("Invalid businessType", 400);
    }
    if (isReadFromPostgres()) {
      return prisma.inventoryMetaField.findMany({
        where: { businessType: safeBusinessType },
        orderBy: { label: "asc" },
      });
    }
    return InventoryMetaFieldModel.find({
      businessType: safeBusinessType,
    }).exec();
  },
};

export const InventoryAlertService = {
  async getLowStockItems(organisationId: string) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    if (isReadFromPostgres()) {
      const items = await prisma.inventoryItem.findMany({
        where: { organisationId: safeOrganisationId },
      });
      return items.filter((i) => {
        if (!i.reorderLevel) return false;
        return (i.onHand ?? 0) <= i.reorderLevel;
      });
    }
    const items = await InventoryItemModel.find({
      organisationId: safeOrganisationId,
    });

    return items.filter((i) => {
      if (!i.reorderLevel) return false;
      return (i.onHand ?? 0) <= i.reorderLevel;
    });
  },

  async getExpiringItems(organisationId: string, days = 7) {
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeDays = sanitizePositiveNumber(days) ?? 7;

    const now = dayjs();
    const threshold = now.add(safeDays, "day").toDate();

    if (isReadFromPostgres()) {
      return prisma.inventoryBatch.findMany({
        where: {
          organisationId: safeOrganisationId,
          expiryDate: { lte: threshold },
        },
        orderBy: { expiryDate: "asc" },
      });
    }

    return InventoryBatchModel.find({
      organisationId: safeOrganisationId,
      expiryDate: { $lte: threshold },
    });
  },
};
