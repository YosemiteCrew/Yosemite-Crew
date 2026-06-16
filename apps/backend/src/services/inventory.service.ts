/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await, @typescript-eslint/no-duplicate-type-constituents */
// src/services/inventory.service.ts
import dayjs from "dayjs";
import { prisma } from "src/config/prisma";
import { getOrgBillingCurrency } from "src/utils/billing";
import {
  InventoryBusinessType,
  InventoryItemType,
  InventoryBatch as PrismaInventoryBatch,
  InventoryItem as PrismaInventoryItem,
  InventoryItemStatus,
  Prisma,
} from "@prisma/client";
import {
  calculateInventoryStockStatus,
  calculatePricingMetrics,
  InventoryStockStatus,
  getInventoryCategories,
  isMedicalInventoryCategory,
  validateInventoryCategorySelection,
} from "src/services/inventory.catalog";

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

const isReadFromPostgres = () => true;
type FilterQuery<T> = Record<string, unknown>;

const InventoryItemModel: any = {};
const InventoryBatchModel: any = {};
const InventoryVendorModel: any = {};
const InventoryMetaFieldModel: any = {};
const InventoryCategoryModel: any = {};
const InventorySubcategoryModel: any = {};
const StockMovementModel: any = {};
const shouldDualWrite = false;
const handleDualWriteError = (_scope: string, _err: unknown) => undefined;
const syncInventoryItemToPostgres = async (_doc: unknown) => undefined;
const syncInventoryBatchToPostgres = async (_doc: unknown) => undefined;
const syncInventoryVendorToPostgres = async (_doc: unknown) => undefined;
const syncInventoryMetaFieldToPostgres = async (_doc: unknown) => undefined;

type InventoryItemMongo = PrismaInventoryItem;
type InventoryBatchMongo = PrismaInventoryBatch;
type InventoryVendorMongo = Prisma.InventoryVendorGetPayload<
  Record<string, never>
>;
type InventoryMetaFieldMongo = Prisma.InventoryMetaFieldGetPayload<
  Record<string, never>
>;

type InventoryItemDocument = PrismaInventoryItem & {
  _id: string;
  save?: () => Promise<void>;
  toObject?: <T = PrismaInventoryItem>() => T;
};
type InventoryBatchDocument = PrismaInventoryBatch & {
  _id: string;
  save?: () => Promise<void>;
  deleteOne?: () => Promise<void>;
  toObject?: <T = PrismaInventoryBatch>() => T;
};
type InventoryVendorDocument = Prisma.InventoryVendorGetPayload<
  Record<string, never>
> & {
  _id: string;
  save?: () => Promise<void>;
  toObject?: <
    T = Prisma.InventoryVendorGetPayload<Record<string, never>>,
  >() => T;
};
type InventoryMetaFieldDocument = Prisma.InventoryMetaFieldGetPayload<
  Record<string, never>
> & {
  _id: string;
  save?: () => Promise<void>;
  toObject?: <
    T = Prisma.InventoryMetaFieldGetPayload<Record<string, never>>,
  >() => T;
};

type InventoryListItem = PrismaInventoryItem & {
  _id: string;
  stockHealth: StockHealthStatus;
  batches?: InventoryBatchLike[];
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

const sanitizeStockStatus = (
  value: unknown,
): InventoryStockStatus | InventoryStockStatus[] | undefined => {
  const allowed = new Set<InventoryStockStatus>([
    "In stock",
    "Low stock",
    "Out of stock",
    "Expiring soon",
    "Expired",
    "Inactive",
  ]);
  if (Array.isArray(value)) {
    const filtered = value.filter(
      (entry): entry is InventoryStockStatus =>
        typeof entry === "string" && allowed.has(entry as InventoryStockStatus),
    );
    return filtered.length ? filtered : undefined;
  }
  return typeof value === "string" && allowed.has(value as InventoryStockStatus)
    ? (value as InventoryStockStatus)
    : undefined;
};

const sanitizePositiveNumber = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value > 0 ? value : undefined;
};

const escapeRegex = (value: string) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const asPositiveInteger = (value: unknown): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const integer = Math.trunc(value);
  return integer > 0 ? integer : undefined;
};

const normalizeInventoryItemType = (
  category: string,
  explicitType?: "MEDICAL" | "NON_MEDICAL" | null,
): InventoryItemType =>
  explicitType === "MEDICAL" || explicitType === "NON_MEDICAL"
    ? explicitType
    : isMedicalInventoryCategory(category)
      ? "MEDICAL"
      : "NON_MEDICAL";

const getCurrentStock = (item: Pick<PrismaInventoryItem, "onHand">) =>
  item.onHand ?? 0;

const getItemPricingSummary = (
  item: Pick<PrismaInventoryItem, "sellingPrice" | "unitCost">,
) =>
  calculatePricingMetrics({
    sellingPrice: item.sellingPrice ?? null,
    costPrice: item.unitCost ?? null,
  });

const getItemStockStatus = (args: {
  active: boolean;
  currentStock: number;
  minimumStock?: number | null;
  reorderLevel?: number | null;
  expiryDate?: Date | null;
}) => {
  const minimumStock = args.minimumStock ?? args.reorderLevel ?? null;
  return calculateInventoryStockStatus({
    active: args.active,
    currentStock: args.currentStock,
    minimumStock,
    expiryDate: args.expiryDate ?? null,
  });
};

type InventorySortableRow = {
  name: string;
  currentStock?: number;
  onHand?: number;
  nearestExpiryDate?: Date | null;
  createdAt?: Date | string | null;
};

const sortInventoryRows = <T extends InventorySortableRow>(
  rows: T[],
  sortBy: ListInventoryFilter["sortBy"],
  sortOrder: ListInventoryFilter["sortOrder"] = "asc",
) => {
  const direction = sortOrder === "desc" ? -1 : 1;
  const field = sortBy ?? "name";
  return [...rows].sort((left, right) => {
    const leftValue =
      field === "stock"
        ? (left.currentStock ?? left.onHand ?? 0)
        : field === "expiryDate"
          ? left.nearestExpiryDate
          : field === "createdAt"
            ? left.createdAt
            : left.name;
    const rightValue =
      field === "stock"
        ? (right.currentStock ?? right.onHand ?? 0)
        : field === "expiryDate"
          ? right.nearestExpiryDate
          : field === "createdAt"
            ? right.createdAt
            : right.name;

    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return 1 * direction;
    if (rightValue == null) return -1 * direction;

    if (leftValue instanceof Date && rightValue instanceof Date) {
      return (leftValue.getTime() - rightValue.getTime()) * direction;
    }
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }
    return String(leftValue).localeCompare(String(rightValue)) * direction;
  });
};

// In Postgres read-mode we still return objects shaped like the legacy models.
const toMongoId = (value: string) => value;

type InventoryItemLike = (InventoryItemMongo | PrismaInventoryItem) & {
  _id: string;
};
type InventoryBatchLike = (InventoryBatchMongo | PrismaInventoryBatch) & {
  _id: string;
};

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
  itemType?: "MEDICAL" | "NON_MEDICAL";

  name: string;
  sku?: string;
  category: string;
  subCategory?: string;

  description?: string;
  imageUrl?: string;
  attachments?: unknown[];

  attributes?: InventoryAttributeMap;

  genericName?: string;
  strength?: string;
  dosageForm?: string;
  routeOfAdministration?: string;
  drugClass?: string;
  prescriptionRequired?: boolean;
  controlledItem?: boolean;
  storageInstructions?: string;
  expiryTrackingRequired?: boolean;
  unitOfMeasure?: string;
  packageQuantity?: number;
  storageLocation?: string;

  costPrice?: number;
  unitCost?: number;
  sellingPrice?: number;
  taxRate?: number;
  currency?: string;
  minimumStock?: number;
  emergencyStockLevel?: number;
  reorderLevel?: number;

  initialOnHand?: number;
  initialAllocated?: number;

  vendorId?: string;

  status?: InventoryStatus;

  batches?: InventoryBatchInput[];
}

export interface UpdateInventoryItemInput {
  itemType?: "MEDICAL" | "NON_MEDICAL";
  name?: string;
  sku?: string;
  category?: string;
  subCategory?: string;

  description?: string;
  imageUrl?: string;
  attachments?: unknown[] | null;

  attributes?: InventoryAttributeMap;

  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  routeOfAdministration?: string | null;
  drugClass?: string | null;
  prescriptionRequired?: boolean | null;
  controlledItem?: boolean | null;
  storageInstructions?: string | null;
  expiryTrackingRequired?: boolean | null;
  unitOfMeasure?: string | null;
  packageQuantity?: number | null;
  storageLocation?: string | null;

  costPrice?: number | null;
  unitCost?: number | null;
  sellingPrice?: number | null;
  taxRate?: number | null;
  currency?: string | null;
  minimumStock?: number | null;
  emergencyStockLevel?: number | null;
  reorderLevel?: number | null;

  vendorId?: string | null;

  status?: InventoryStatus;
}

export interface ListInventoryFilter {
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

const groupBatchesByItem = (batches: InventoryBatchLike[]) => {
  const batchesByItem = new Map<string, InventoryBatchLike[]>();
  for (const b of batches) {
    const key = b.itemId.toString();
    if (!batchesByItem.has(key)) batchesByItem.set(key, []);
    batchesByItem.get(key)!.push(b);
  }
  return batchesByItem;
};

const getNearestExpiry = (batches: InventoryBatchLike[]) => {
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
};

/**
 * HELPER: validate ObjectId
 */
const ensureObjectId = (id: string, fieldName = "id"): string => {
  if (!asNonEmptyString(id)) {
    throw new InventoryServiceError(`Invalid ${fieldName}`, 400);
  }
  return id;
};

/**
 * HELPER: log stock movment
 */
const logMovement = async (payload: StockMovementInput) => {
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
    if (input.name.trim().length > 255) {
      throw new InventoryServiceError("name is too long", 400);
    }
    if (input.sku !== undefined && !input.sku.trim()) {
      throw new InventoryServiceError("sku is required", 400);
    }

    const organisationId = ensureNonEmptyString(
      input.organisationId,
      "organisationId",
    );
    const businessType = sanitizeBusinessType(input.businessType);
    if (!businessType) {
      throw new InventoryServiceError("Invalid businessType", 400);
    }
    const category = ensureNonEmptyString(input.category, "category");
    const subCategory = asNonEmptyString(input.subCategory);

    const categoryCheck = validateInventoryCategorySelection(
      category,
      subCategory,
    );
    if (categoryCheck.categoryExists && !categoryCheck.subcategoryValid) {
      throw new InventoryServiceError(
        "subcategory must belong to category",
        400,
      );
    }

    const itemType = normalizeInventoryItemType(
      category,
      input.itemType ?? null,
    );
    const isMedicalCategory = itemType === "MEDICAL";

    if (isMedicalCategory) {
      for (const [field, value] of [
        ["genericName", input.genericName],
        ["strength", input.strength],
        ["dosageForm", input.dosageForm],
        ["routeOfAdministration", input.routeOfAdministration],
      ] as const) {
        if (!asNonEmptyString(value)) {
          throw new InventoryServiceError(
            `${field} is required for medical items`,
            400,
          );
        }
      }
    }

    for (const [field, value] of [
      ["initialOnHand", input.initialOnHand],
      ["initialAllocated", input.initialAllocated],
      ["minimumStock", input.minimumStock],
      ["emergencyStockLevel", input.emergencyStockLevel],
      ["reorderLevel", input.reorderLevel],
      ["unitCost", input.unitCost ?? input.costPrice],
      ["sellingPrice", input.sellingPrice],
      ["taxRate", input.taxRate],
      ["packageQuantity", input.packageQuantity],
    ] as const) {
      if (typeof value === "number" && value < 0) {
        throw new InventoryServiceError(`${field} cannot be negative`, 400);
      }
    }

    if (input.expiryTrackingRequired && !input.batches?.length) {
      throw new InventoryServiceError(
        "expiry date is required when expiry tracking is enabled",
        400,
      );
    }

    if (input.expiryTrackingRequired && input.batches?.length) {
      const missingExpiry = input.batches.some(
        (batch) =>
          !batch.expiryDate || Number.isNaN(batch.expiryDate.getTime()),
      );
      if (missingExpiry) {
        throw new InventoryServiceError(
          "expiry date is required when expiry tracking is enabled",
          400,
        );
      }
    }

    if (input.sku) {
      const existingSku = isReadFromPostgres()
        ? await prisma.inventoryItem.findFirst({
            where: {
              organisationId,
              sku: input.sku,
            },
          })
        : await InventoryItemModel.findOne({
            organisationId,
            sku: input.sku,
          }).exec();
      if (existingSku) {
        throw new InventoryServiceError(
          "sku must be unique within the organisation",
          409,
        );
      }
    }

    const currency = await getOrgBillingCurrency(organisationId);
    const unitCost = input.costPrice ?? input.unitCost ?? undefined;
    const attachments = input.attachments ?? undefined;

    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.create({
        data: {
          organisationId,
          businessType: businessType as InventoryBusinessType,
          itemType,
          name: input.name,
          sku: input.sku ?? undefined,
          category,
          subCategory: subCategory ?? undefined,
          description: input.description ?? undefined,
          imageUrl: input.imageUrl ?? undefined,
          attachments: attachments as Prisma.InputJsonValue | undefined,
          attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
          genericName: input.genericName ?? undefined,
          strength: input.strength ?? undefined,
          dosageForm: input.dosageForm ?? undefined,
          routeOfAdministration: input.routeOfAdministration ?? undefined,
          drugClass: input.drugClass ?? undefined,
          prescriptionRequired: input.prescriptionRequired ?? false,
          controlledItem: input.controlledItem ?? false,
          storageInstructions: input.storageInstructions ?? undefined,
          expiryTrackingRequired: input.expiryTrackingRequired ?? false,
          unitOfMeasure: input.unitOfMeasure ?? undefined,
          packageQuantity: input.packageQuantity ?? undefined,
          storageLocation: input.storageLocation ?? undefined,
          unitCost,
          sellingPrice: input.sellingPrice ?? undefined,
          taxRate: input.taxRate ?? undefined,
          currency,
          minimumStock: input.minimumStock ?? undefined,
          emergencyStockLevel: input.emergencyStockLevel ?? undefined,
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
          _id: item.id,
        },
        batches: batches.map((batch) => ({
          ...batch,
          _id: batch.id,
        })),
      };
    }

    // 1. Create item with basic data (onHand will be recomputed if batches)
    const item = await InventoryItemModel.create({
      organisationId,
      businessType,
      itemType,

      name: input.name,
      sku: input.sku,
      category,
      subCategory: subCategory ?? undefined,

      description: input.description,
      imageUrl: input.imageUrl,
      attachments,

      attributes: input.attributes ?? {},
      genericName: input.genericName,
      strength: input.strength,
      dosageForm: input.dosageForm,
      routeOfAdministration: input.routeOfAdministration,
      drugClass: input.drugClass,
      prescriptionRequired: input.prescriptionRequired ?? false,
      controlledItem: input.controlledItem ?? false,
      storageInstructions: input.storageInstructions,
      expiryTrackingRequired: input.expiryTrackingRequired ?? false,
      unitOfMeasure: input.unitOfMeasure,
      packageQuantity: input.packageQuantity,
      storageLocation: input.storageLocation,

      unitCost,
      sellingPrice: input.sellingPrice ?? undefined,
      taxRate: input.taxRate ?? undefined,
      currency,
      minimumStock: input.minimumStock ?? undefined,
      emergencyStockLevel: input.emergencyStockLevel ?? undefined,
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
            data: createdBatches.map((doc: any) => ({
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
  async updateItem(
    itemId: string,
    input: UpdateInventoryItemInput,
    organisationId: string,
  ) {
    ensureObjectId(itemId, "itemId");
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );

    if (isReadFromPostgres()) {
      const existing = await prisma.inventoryItem.findFirst({
        where: { id: itemId, organisationId: safeOrganisationId },
      });
      if (!existing) {
        throw new InventoryServiceError("Inventory item not found", 404);
      }

      const nextCategory = input.category ?? existing.category ?? undefined;
      const nextSubCategory =
        input.subCategory !== undefined
          ? asNonEmptyString(input.subCategory)
          : (existing.subCategory ?? undefined);
      if (nextCategory) {
        const categoryCheck = validateInventoryCategorySelection(
          nextCategory,
          nextSubCategory,
        );
        if (categoryCheck.categoryExists && !categoryCheck.subcategoryValid) {
          throw new InventoryServiceError(
            "subcategory must belong to category",
            400,
          );
        }
      }

      const nextItemType = normalizeInventoryItemType(
        nextCategory ?? "GENERAL",
        input.itemType ?? existing.itemType,
      );
      if (nextItemType === "MEDICAL") {
        for (const [field, value] of [
          ["genericName", input.genericName ?? existing.genericName],
          ["strength", input.strength ?? existing.strength],
          ["dosageForm", input.dosageForm ?? existing.dosageForm],
          [
            "routeOfAdministration",
            input.routeOfAdministration ?? existing.routeOfAdministration,
          ],
        ] as const) {
          if (!asNonEmptyString(value)) {
            throw new InventoryServiceError(
              `${field} is required for medical items`,
              400,
            );
          }
        }
      }

      for (const [field, value] of [
        ["minimumStock", input.minimumStock],
        ["emergencyStockLevel", input.emergencyStockLevel],
        ["reorderLevel", input.reorderLevel],
        ["unitCost", input.unitCost ?? input.costPrice],
        ["sellingPrice", input.sellingPrice],
        ["taxRate", input.taxRate],
        ["packageQuantity", input.packageQuantity],
      ] as const) {
        if (typeof value === "number" && value < 0) {
          throw new InventoryServiceError(`${field} cannot be negative`, 400);
        }
      }

      if (input.sku !== undefined) {
        const duplicate = await prisma.inventoryItem.findFirst({
          where: {
            organisationId: safeOrganisationId,
            sku: input.sku,
            NOT: { id: itemId },
          },
        });
        if (duplicate) {
          throw new InventoryServiceError(
            "sku must be unique within the organisation",
            409,
          );
        }
      }

      const data: Prisma.InventoryItemUpdateInput = {};

      if (input.itemType !== undefined) {
        data.itemType = input.itemType;
      } else if (nextItemType !== existing.itemType) {
        data.itemType = nextItemType;
      }
      if (input.name !== undefined) data.name = input.name;
      if (input.sku !== undefined) data.sku = input.sku ?? null;
      if (input.category !== undefined) data.category = input.category;
      if (input.subCategory !== undefined) {
        data.subCategory = input.subCategory ?? null;
      }
      if (input.description !== undefined) {
        data.description = input.description ?? null;
      }
      if (input.imageUrl !== undefined) {
        data.imageUrl = input.imageUrl ?? null;
      }
      if (input.attachments !== undefined) {
        data.attachments =
          input.attachments === null
            ? Prisma.DbNull
            : (input.attachments as Prisma.InputJsonValue);
      }
      if (input.attributes !== undefined) {
        data.attributes = input.attributes as Prisma.InputJsonValue;
      }
      if (input.genericName !== undefined)
        data.genericName = input.genericName ?? null;
      if (input.strength !== undefined) data.strength = input.strength ?? null;
      if (input.dosageForm !== undefined)
        data.dosageForm = input.dosageForm ?? null;
      if (input.routeOfAdministration !== undefined) {
        data.routeOfAdministration = input.routeOfAdministration ?? null;
      }
      if (input.drugClass !== undefined)
        data.drugClass = input.drugClass ?? null;
      if (input.prescriptionRequired !== undefined) {
        data.prescriptionRequired = input.prescriptionRequired ?? false;
      }
      if (input.controlledItem !== undefined) {
        data.controlledItem = input.controlledItem ?? false;
      }
      if (input.storageInstructions !== undefined) {
        data.storageInstructions = input.storageInstructions ?? null;
      }
      if (input.expiryTrackingRequired !== undefined) {
        data.expiryTrackingRequired = input.expiryTrackingRequired ?? false;
      }
      if (input.unitOfMeasure !== undefined) {
        data.unitOfMeasure = input.unitOfMeasure ?? null;
      }
      if (input.packageQuantity !== undefined) {
        data.packageQuantity = input.packageQuantity ?? null;
      }
      if (input.storageLocation !== undefined) {
        data.storageLocation = input.storageLocation ?? null;
      }

      if (input.unitCost !== undefined || input.costPrice !== undefined) {
        data.unitCost = input.costPrice ?? input.unitCost ?? null;
      }
      if (input.sellingPrice !== undefined) {
        data.sellingPrice = input.sellingPrice ?? null;
      }
      if (input.taxRate !== undefined) data.taxRate = input.taxRate ?? null;
      if (input.currency !== undefined) {
        data.currency = await getOrgBillingCurrency(existing.organisationId);
      }
      if (input.minimumStock !== undefined) {
        data.minimumStock = input.minimumStock ?? null;
      }
      if (input.emergencyStockLevel !== undefined) {
        data.emergencyStockLevel = input.emergencyStockLevel ?? null;
      }
      if (input.reorderLevel !== undefined) {
        data.reorderLevel = input.reorderLevel ?? null;
      }
      if (input.vendorId !== undefined) data.vendorId = input.vendorId ?? null;
      if (input.status !== undefined) {
        data.status = input.status as InventoryItemStatus;
      }

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
          _id: updated.id,
        },
        batches: batches.map((batch) => ({
          ...batch,
          _id: batch.id,
        })),
      };
    }

    const item = await InventoryItemModel.findOne({
      _id: itemId,
      organisationId: safeOrganisationId,
    }).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }

    const nextCategory = input.category ?? item.category ?? undefined;
    const nextSubCategory =
      input.subCategory !== undefined
        ? asNonEmptyString(input.subCategory)
        : (item.subCategory ?? undefined);
    if (nextCategory) {
      const categoryCheck = validateInventoryCategorySelection(
        nextCategory,
        nextSubCategory,
      );
      if (categoryCheck.categoryExists && !categoryCheck.subcategoryValid) {
        throw new InventoryServiceError(
          "subcategory must belong to category",
          400,
        );
      }
    }

    const nextItemType = normalizeInventoryItemType(
      nextCategory ?? "GENERAL",
      input.itemType ?? item.itemType,
    );
    if (nextItemType === "MEDICAL") {
      for (const [field, value] of [
        ["genericName", input.genericName ?? item.genericName],
        ["strength", input.strength ?? item.strength],
        ["dosageForm", input.dosageForm ?? item.dosageForm],
        [
          "routeOfAdministration",
          input.routeOfAdministration ?? item.routeOfAdministration,
        ],
      ] as const) {
        if (!asNonEmptyString(value)) {
          throw new InventoryServiceError(
            `${field} is required for medical items`,
            400,
          );
        }
      }
    }

    for (const [field, value] of [
      ["minimumStock", input.minimumStock],
      ["emergencyStockLevel", input.emergencyStockLevel],
      ["reorderLevel", input.reorderLevel],
      ["unitCost", input.unitCost ?? input.costPrice],
      ["sellingPrice", input.sellingPrice],
      ["taxRate", input.taxRate],
      ["packageQuantity", input.packageQuantity],
    ] as const) {
      if (typeof value === "number" && value < 0) {
        throw new InventoryServiceError(`${field} cannot be negative`, 400);
      }
    }

    if (input.sku !== undefined) {
      const duplicate = await InventoryItemModel.findOne({
        organisationId: safeOrganisationId,
        sku: input.sku,
        _id: { $ne: itemId },
      }).exec();
      if (duplicate) {
        throw new InventoryServiceError(
          "sku must be unique within the organisation",
          409,
        );
      }
    }

    if (input.name !== undefined) item.name = input.name;
    if (input.sku !== undefined) item.sku = input.sku;
    if (input.itemType !== undefined) item.itemType = input.itemType;
    else item.itemType = nextItemType;
    if (input.category !== undefined) item.category = input.category;
    else item.category = nextCategory;
    if (input.subCategory !== undefined) item.subCategory = input.subCategory;
    else item.subCategory = nextSubCategory;

    if (input.description !== undefined) item.description = input.description;
    if (input.imageUrl !== undefined) item.imageUrl = input.imageUrl;
    if (input.attachments !== undefined)
      item.attachments = input.attachments ?? undefined;

    if (input.attributes !== undefined) {
      item.attributes = input.attributes;
    }
    if (input.genericName !== undefined)
      item.genericName = input.genericName ?? undefined;
    if (input.strength !== undefined)
      item.strength = input.strength ?? undefined;
    if (input.dosageForm !== undefined)
      item.dosageForm = input.dosageForm ?? undefined;
    if (input.routeOfAdministration !== undefined) {
      item.routeOfAdministration = input.routeOfAdministration ?? undefined;
    }
    if (input.drugClass !== undefined)
      item.drugClass = input.drugClass ?? undefined;
    if (input.prescriptionRequired !== undefined) {
      item.prescriptionRequired = input.prescriptionRequired ?? false;
    }
    if (input.controlledItem !== undefined) {
      item.controlledItem = input.controlledItem ?? false;
    }
    if (input.storageInstructions !== undefined) {
      item.storageInstructions = input.storageInstructions ?? undefined;
    }
    if (input.expiryTrackingRequired !== undefined) {
      item.expiryTrackingRequired = input.expiryTrackingRequired ?? false;
    }
    if (input.unitOfMeasure !== undefined) {
      item.unitOfMeasure = input.unitOfMeasure ?? undefined;
    }
    if (input.packageQuantity !== undefined) {
      item.packageQuantity = input.packageQuantity ?? undefined;
    }
    if (input.storageLocation !== undefined) {
      item.storageLocation = input.storageLocation ?? undefined;
    }

    if (input.unitCost !== undefined || input.costPrice !== undefined)
      item.unitCost = input.costPrice ?? input.unitCost ?? undefined;
    if (input.sellingPrice !== undefined)
      item.sellingPrice = input.sellingPrice ?? undefined;
    if (input.taxRate !== undefined) item.taxRate = input.taxRate ?? undefined;
    if (input.currency !== undefined)
      item.currency = await getOrgBillingCurrency(
        item.organisationId.toString(),
      );
    if (input.minimumStock !== undefined)
      item.minimumStock = input.minimumStock ?? undefined;
    if (input.emergencyStockLevel !== undefined)
      item.emergencyStockLevel = input.emergencyStockLevel ?? undefined;
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
  async hideItem(
    itemId: string,
    organisationId: string,
  ): Promise<InventoryItemLike> {
    ensureObjectId(itemId, "itemId");
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: itemId, organisationId: safeOrganisationId },
      });
      if (!item) {
        throw new InventoryServiceError("Inventory item not found", 404);
      }
      const updated = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { status: "HIDDEN" },
      });
      return {
        ...updated,
        _id: updated.id,
      };
    }
    const item = await InventoryItemModel.findOne({
      _id: itemId,
      organisationId: safeOrganisationId,
    }).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }
    item.status = "HIDDEN";
    await item.save();
    await syncInventoryItemToPostgres(item);
    return item.toObject();
  },

  async archiveItem(
    itemId: string,
    organisationId: string,
  ): Promise<InventoryItemLike> {
    ensureObjectId(itemId, "itemId");
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: itemId, organisationId: safeOrganisationId },
      });
      if (!item) {
        throw new InventoryServiceError("Inventory item not found", 404);
      }
      const updated = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { status: "DELETED" },
      });
      return {
        ...updated,
        _id: updated.id,
      };
    }
    const item = await InventoryItemModel.findOne({
      _id: itemId,
      organisationId: safeOrganisationId,
    }).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }
    item.status = "DELETED";
    await item.save();
    await syncInventoryItemToPostgres(item);
    return item.toObject();
  },

  async activeItem(
    itemId: string,
    organisationId: string,
  ): Promise<InventoryItemLike> {
    ensureObjectId(itemId, "itemId");
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    if (isReadFromPostgres()) {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: itemId, organisationId: safeOrganisationId },
      });
      if (!item) {
        throw new InventoryServiceError("Inventory item not found", 404);
      }
      const updated = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: { status: "ACTIVE" },
      });
      return {
        ...updated,
        _id: updated.id,
      };
    }
    const item = await InventoryItemModel.findOne({
      _id: itemId,
      organisationId: safeOrganisationId,
    }).exec();
    if (!item) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }
    item.status = "ACTIVE";
    await item.save();
    await syncInventoryItemToPostgres(item);
    return item.toObject();
  },

  // ─────────────────────────────────────────────
  // LIST ITEMS (table view)
  // ─────────────────────────────────────────────
  async listItems(filter: ListInventoryFilter): Promise<
    | InventoryListItem[]
    | {
        items: InventoryListItem[];
        page: number;
        pageSize: number;
        total: number;
      }
  > {
    const organisationId = ensureNonEmptyString(
      filter.organisationId,
      "organisationId",
    );
    const query: FilterQuery<InventoryItemMongo> = {
      organisationId,
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
    const stockStatusFilter = sanitizeStockStatus(filter.stockStatus);

    const vendorSearch = asNonEmptyString(filter.vendor);
    let vendorIds: string[] = [];
    if (vendorSearch) {
      if (isReadFromPostgres()) {
        const vendors = await prisma.inventoryVendor.findMany({
          where: {
            organisationId,
            OR: [
              { id: vendorSearch },
              { name: { contains: vendorSearch, mode: "insensitive" } },
              {
                vendorItemCode: {
                  contains: vendorSearch,
                  mode: "insensitive",
                },
              },
            ],
          },
          select: { id: true },
        });
        vendorIds = vendors.map((vendor) => vendor.id);
      } else {
        const vendors = await InventoryVendorModel.find({
          organisationId,
          $or: [
            { _id: vendorSearch },
            { name: { $regex: escapeRegex(vendorSearch), $options: "i" } },
            {
              vendorItemCode: {
                $regex: escapeRegex(vendorSearch),
                $options: "i",
              },
            },
          ],
        })
          .select({ _id: 1 })
          .exec();
        vendorIds = vendors.map((vendor: { _id: { toString(): string } }) =>
          vendor._id.toString(),
        );
      }
      if (!vendorIds.length && filter.vendor) {
        return [];
      }
    }

    if (vendorIds.length) {
      (query as { vendorId?: { $in: string[] } }).vendorId = {
        $in: vendorIds,
      };
    }

    const applyItemMeta = (
      item: InventoryItemLike,
      itemBatches: InventoryBatchLike[],
    ) => {
      const nearestExpiry = getNearestExpiry(itemBatches);
      const pricing = getItemPricingSummary(item);
      const stockHealth = computeStockHealthStatus({
        onHand: item.onHand ?? 0,
        reorderLevel: item.reorderLevel ?? null,
        nearestExpiry,
        soonThresholdDays: expiringWithinDays ?? 7,
      });
      const stockStatus = getItemStockStatus({
        active: item.status === "ACTIVE",
        currentStock: getCurrentStock(item),
        minimumStock: item.minimumStock ?? null,
        reorderLevel: item.reorderLevel ?? null,
        expiryDate: nearestExpiry,
      });

      return {
        ...item,
        stockHealth,
        stockStatus,
        currentStock: item.onHand ?? 0,
        minimumStock: item.minimumStock ?? null,
        emergencyStockLevel: item.emergencyStockLevel ?? null,
        unitOfMeasure: item.unitOfMeasure ?? null,
        costPrice: item.unitCost ?? null,
        grossProfit: pricing.grossProfit,
        marginPercentage: pricing.marginPercentage,
        nearestExpiryDate: nearestExpiry,
        batches: itemBatches,
      } as InventoryListItem & {
        currentStock: number;
        stockStatus: string;
        minimumStock: number | null;
        emergencyStockLevel: number | null;
        unitOfMeasure: string | null;
        costPrice: number | null;
        grossProfit: number;
        marginPercentage: number | null;
        nearestExpiryDate: Date | null;
      };
    };

    if (isReadFromPostgres()) {
      const where: Prisma.InventoryItemWhereInput = {
        organisationId,
      };

      if (query.businessType) {
        where.businessType = query.businessType as InventoryBusinessType;
      }
      if (query.category) where.category = query.category as string;
      if (query.subCategory) where.subCategory = query.subCategory as string;
      if (vendorIds.length) {
        where.vendorId = { in: vendorIds };
      }
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
            let pattern = "";
            if (value instanceof RegExp) {
              pattern = value.source;
            } else if (
              typeof value === "object" &&
              value !== null &&
              "$regex" in value &&
              typeof value.$regex === "string"
            ) {
              pattern = value.$regex;
            }
            return pattern
              ? { [key]: { contains: pattern, mode: "insensitive" } }
              : {};
          },
        ) as Prisma.InventoryItemWhereInput[];
      }

      const items = await prisma.inventoryItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      const itemIds = items.map((i) => i.id);
      const batches = await prisma.inventoryBatch.findMany({
        where: { itemId: { in: itemIds } },
      });

      const batchesByItem = groupBatchesByItem(
        batches.map((batch) => ({ ...batch, _id: batch.id })),
      );

      const result = items
        .map((item) =>
          applyItemMeta(
            { ...item, _id: item.id },
            batchesByItem.get(item.id) ?? [],
          ),
        )
        .filter(
          (item) =>
            shouldIncludeItem({
              filter,
              stockHealth: item.stockHealth,
              expiringWithinDays,
            }) &&
            (stockStatusFilter === undefined ||
              (Array.isArray(stockStatusFilter)
                ? stockStatusFilter.includes(
                    item.stockStatus as InventoryStockStatus,
                  )
                : item.stockStatus === stockStatusFilter)),
        );

      const sorted = filter.sortBy
        ? sortInventoryRows(result, filter.sortBy, filter.sortOrder)
        : result;
      if (filter.page || filter.pageSize) {
        const page = asPositiveInteger(filter.page) ?? 1;
        const pageSize = asPositiveInteger(filter.pageSize) ?? 25;
        const start = (page - 1) * pageSize;
        return {
          items: sorted.slice(start, start + pageSize),
          page,
          pageSize,
          total: sorted.length,
        };
      }

      return sorted;
    }

    const items = await InventoryItemModel.find(query)
      .sort({ createdAt: -1 })
      .exec();

    const itemIds = items.map((i: { _id: { toString(): string } }) =>
      i._id.toString(),
    );
    const batches = await InventoryBatchModel.find({
      itemId: { $in: itemIds },
    }).exec();

    const batchesByItem = groupBatchesByItem(batches);

    const result = items
      .map((item: any) => {
        const itemBatches = batchesByItem.get(item._id.toString()) ?? [];
        const nearestExpiry = getNearestExpiry(itemBatches);
        const stockHealth = computeStockHealthStatus({
          onHand: item.onHand ?? 0,
          reorderLevel: item.reorderLevel ?? null,
          nearestExpiry,
          soonThresholdDays: expiringWithinDays ?? 7,
        });

        if (!shouldIncludeItem({ filter, stockHealth, expiringWithinDays })) {
          return null;
        }

        const pricing = getItemPricingSummary(item);
        const stockStatus = getItemStockStatus({
          active: item.status === "ACTIVE",
          currentStock: getCurrentStock(item),
          minimumStock: item.minimumStock ?? null,
          reorderLevel: item.reorderLevel ?? null,
          expiryDate: nearestExpiry,
        });

        const itemObject = item.toObject();
        return {
          ...itemObject,
          stockHealth,
          stockStatus,
          currentStock: item.onHand ?? 0,
          minimumStock: item.minimumStock ?? null,
          emergencyStockLevel: item.emergencyStockLevel ?? null,
          unitOfMeasure: item.unitOfMeasure ?? null,
          costPrice: item.unitCost ?? null,
          grossProfit: pricing.grossProfit,
          marginPercentage: pricing.marginPercentage,
          nearestExpiryDate: nearestExpiry,
          batches: itemBatches,
        } as InventoryListItem & {
          currentStock: number;
          stockStatus: string;
          minimumStock: number | null;
          emergencyStockLevel: number | null;
          unitOfMeasure: string | null;
          costPrice: number | null;
          grossProfit: number;
          marginPercentage: number | null;
          nearestExpiryDate: Date | null;
        };
      })
      .filter(
        (item: any): item is NonNullable<typeof item> =>
          item !== null &&
          (stockStatusFilter === undefined ||
            (Array.isArray(stockStatusFilter)
              ? stockStatusFilter.includes(
                  item.stockStatus as InventoryStockStatus,
                )
              : item.stockStatus === stockStatusFilter)),
      );

    const sorted = filter.sortBy
      ? sortInventoryRows(result, filter.sortBy, filter.sortOrder)
      : result;
    if (filter.page || filter.pageSize) {
      const page = asPositiveInteger(filter.page) ?? 1;
      const pageSize = asPositiveInteger(filter.pageSize) ?? 25;
      const start = (page - 1) * pageSize;
      return {
        items: sorted.slice(start, start + pageSize),
        page,
        pageSize,
        total: sorted.length,
      };
    }

    return sorted;
  },

  async getCategories(): Promise<
    Array<{
      id?: string;
      code: string;
      name: string;
      isMedical: boolean;
      sortOrder: number;
      subcategories: Array<{
        id?: string;
        categoryId?: string;
        code: string;
        name: string;
        sortOrder?: number;
        isActive?: boolean;
      }>;
    }>
  > {
    if (isReadFromPostgres()) {
      const categories = await prisma.inventoryCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      const subcategories = await prisma.inventorySubcategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      if (categories.length) {
        return categories.map((category) => ({
          id: category.id,
          code: category.code,
          name: category.name,
          isMedical: category.isMedical,
          sortOrder: category.sortOrder,
          subcategories: subcategories
            .filter(
              (subcat) =>
                subcat.categoryId === category.id ||
                subcat.categoryId === category.code,
            )
            .map((subcat) => ({
              id: subcat.id,
              categoryId: subcat.categoryId,
              code: subcat.code,
              name: subcat.name,
              sortOrder: subcat.sortOrder,
              isActive: subcat.isActive,
            })),
        }));
      }
    } else {
      const categories = await InventoryCategoryModel.find({})
        .sort({ sortOrder: 1, name: 1 })
        .exec();
      const subcategories = await InventorySubcategoryModel.find({})
        .sort({ sortOrder: 1, name: 1 })
        .exec();
      if (categories.length) {
        const categoryRows = categories as Array<{
          _id?: { toString(): string };
          code: string;
          name: string;
          isMedical: boolean;
          sortOrder: number;
        }>;
        const subcategoryRows = subcategories as Array<{
          _id?: { toString(): string };
          categoryId: string;
          code: string;
          name: string;
          sortOrder: number;
          isActive: boolean;
        }>;

        return categoryRows.map((category) => {
          const categoryId = category._id?.toString() ?? category.code;
          const matchedSubcategories = subcategoryRows.filter(
            (subcat) =>
              subcat.categoryId === category.code ||
              subcat.categoryId === categoryId,
          );

          return {
            id: categoryId,
            code: category.code,
            name: category.name,
            isMedical: category.isMedical,
            sortOrder: category.sortOrder,
            subcategories: matchedSubcategories.map((subcat) => {
              const subcategoryId = subcat._id?.toString() ?? subcat.code;
              return {
                id: subcategoryId,
                categoryId: subcat.categoryId,
                code: subcat.code,
                name: subcat.name,
                sortOrder: subcat.sortOrder,
                isActive: subcat.isActive,
              };
            }),
          };
        });
      }
    }

    return getInventoryCategories();
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
      if (item.organisationId !== safeOrganisationId) {
        throw new InventoryServiceError("Inventory item not found", 404);
      }

      const vendor = item.vendorId
        ? await prisma.inventoryVendor.findFirst({
            where: {
              id: item.vendorId,
              organisationId: safeOrganisationId,
            },
          })
        : null;
      const nearestExpiry = getNearestExpiry(
        batches.map((batch) => ({ ...batch, _id: batch.id })),
      );
      const pricing = getItemPricingSummary(item);
      const stockStatus = getItemStockStatus({
        active: item.status === "ACTIVE",
        currentStock: item.onHand ?? 0,
        minimumStock: item.minimumStock ?? null,
        reorderLevel: item.reorderLevel ?? null,
        expiryDate: nearestExpiry,
      });

      return {
        item: {
          ...item,
          _id: toMongoId(item.id),
          currentStock: item.onHand ?? 0,
          stockStatus,
          costPrice: item.unitCost ?? null,
          grossProfit: pricing.grossProfit,
          marginPercentage: pricing.marginPercentage,
          nearestExpiryDate: nearestExpiry,
          vendor: vendor
            ? {
                ...vendor,
                _id: vendor.id,
              }
            : null,
        } as unknown as InventoryItemDocument,
        batches: batches.map((batch) => ({
          ...batch,
          _id: toMongoId(batch.id),
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
    if (item.organisationId.toString() !== safeOrganisationId) {
      throw new InventoryServiceError("Inventory item not found", 404);
    }

    const vendor = item.vendorId
      ? await InventoryVendorModel.findOne({
          _id: item.vendorId,
          organisationId: safeOrganisationId,
        }).exec()
      : null;
    const nearestExpiry = getNearestExpiry(
      batches.map((batch: InventoryBatchLike) => ({
        ...batch,
        _id: batch._id,
      })),
    );
    const pricing = getItemPricingSummary(item);
    const stockStatus = getItemStockStatus({
      active: item.status === "ACTIVE",
      currentStock: item.onHand ?? 0,
      minimumStock: item.minimumStock ?? null,
      reorderLevel: item.reorderLevel ?? null,
      expiryDate: nearestExpiry,
    });

    return {
      item: {
        ...(typeof item.toObject === "function" ? item.toObject() : item),
        currentStock: item.onHand ?? 0,
        stockStatus,
        costPrice: item.unitCost ?? null,
        grossProfit: pricing.grossProfit,
        marginPercentage: pricing.marginPercentage,
        nearestExpiryDate: nearestExpiry,
        vendor: vendor ? vendor.toObject() : null,
      } as unknown as InventoryItemDocument,
      batches,
    };
  },

  // ─────────────────────────────────────────────
  // BATCH OPERATIONS
  // ─────────────────────────────────────────────
  async addBatch(
    itemId: string,
    batchInput: InventoryBatchInput,
  ): Promise<InventoryBatchLike> {
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
        _id: batch.id,
      };
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

    return typeof (batch as { toObject?: () => unknown }).toObject ===
      "function"
      ? (batch as { toObject: () => InventoryBatchLike }).toObject()
      : (batch as unknown as InventoryBatchLike);
  },

  async updateBatch(
    batchId: string,
    input: Partial<InventoryBatchInput>,
  ): Promise<InventoryBatchLike> {
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
        _id: updated.id,
      };
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

    return batch.toObject();
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
  async consumeStock(input: ConsumeStockInput): Promise<InventoryItemLike> {
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
        _id: toMongoId(updated.id),
      };
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
  ): Promise<InventoryItemLike[]> {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new InventoryServiceError("items must be a non-empty array", 400);
    }

    const results: InventoryItemLike[] = [];
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

    const itemIds = items.map((i: { _id: { toString(): string } }) =>
      i._id.toString(),
    );

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
      const batchesAtStart = (await InventoryBatchModel.aggregate([
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
      ])) as Array<{ qty: number }>;

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
  }): Promise<InventoryItemLike> {
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
        _id: toMongoId(updated.id),
      };
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
    batches.forEach((b: { quantity: number; allocated?: number }) => {
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
  }): Promise<InventoryItemLike> {
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
        _id: toMongoId(updated.id),
      };
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
  }): Promise<InventoryItemLike> {
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
        _id: toMongoId(updated.id),
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

    return items.filter((i: { reorderLevel?: number; onHand?: number }) => {
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
