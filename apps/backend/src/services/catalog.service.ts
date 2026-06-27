import type {
  AppointmentKind,
  CatalogListRow,
  CatalogPackageDetail,
  CatalogPackageBreakdownRow,
  CatalogPricePolicy,
  CatalogPackageSummary,
  CatalogTab,
  CatalogTemplateBinding,
  PackageItemPricingMode,
  ProductKind,
  ResolvedCatalogItem,
  ResolvedCatalogSelection,
  SpecialityCatalogView,
  TemplateKind,
} from "@yosemite-crew/types";
import {
  normalizeTemplateKind,
  toLegacyTemplateKind,
} from "@yosemite-crew/types";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { Prisma } from "@prisma/client";
import { AvailabilitySlotMongo } from "src/models/base-availability";
import { prisma } from "src/config/prisma";
import { AvailabilityService } from "./availability.service";
import {
  addCachedPromise,
  type CachedPromise,
} from "src/utils/cached-promise-cache";
import logger from "src/utils/logger";
import {
  buildBookableWindowsForVets,
  mapOrganisationWithAddress,
  normalizeSlotForSelectedDay,
  resolveOrganisationTimezone,
} from "src/utils/scheduling";
import { filterWithinRadius, getBoundingDeltas } from "src/utils/geo";

dayjs.extend(utc);

export type CatalogPackageItemInput = {
  childProductItemId: string;
  quantity: number;
  pricingMode: PackageItemPricingMode;
  overridePrice?: number | null;
  discountPercent?: number | null;
  sortOrder?: number;
  isOptional?: boolean;
};

export type CatalogBookableInput = {
  durationMinutes: number;
  supportsOutpatient?: boolean;
  supportsInpatient?: boolean;
};

export type CatalogProductUpsertInput = {
  organisationId: string;
  name: string;
  description?: string | null;
  code?: string | null;
  kind: ProductKind;
  specialityId?: string | null;
  legacyServiceId?: string | null;
  isActive?: boolean;
  price?: CatalogPricePolicy | null;
  bookable?: CatalogBookableInput | null;
  package?: CatalogPackageSummary | null;
  packageItems?: CatalogPackageItemInput[] | null;
};

export type CatalogProductListFilters = {
  organisationId: string;
  specialityId?: string;
  kinds?: ProductKind[];
  includeInactive?: boolean;
  active?: boolean;
  search?: string;
  supportsInpatient?: boolean;
};

export type CatalogProductView = {
  id: string;
  version: number;
  organisationId: string;
  name: string;
  description: string | null;
  code: string | null;
  kind: ProductKind;
  specialityId: string | null;
  legacyServiceId: string | null;
  isActive: boolean;
  defaultPrice: (CatalogPricePolicy & { isDefault: boolean }) | null;
  bookable: {
    durationMinutes: number;
    supportsOutpatient: boolean;
    supportsInpatient: boolean;
  } | null;
  package: CatalogPackageSummary | null;
  packageItems: Array<{
    id: string;
    childProductItemId: string;
    childProductName: string;
    childProductKind: ProductKind;
    quantity: number;
    pricingMode: PackageItemPricingMode;
    overridePrice: number | null;
    discountPercent: number | null;
    sortOrder: number;
    isOptional: boolean;
    childProductCode: string | null;
    currency: string | null;
    grossAmount: number;
    discountAmount: number;
    finalAmount: number;
  }>;
};

export type SpecialityCatalogFilters = {
  organisationId: string;
  specialityId: string;
  tab?: CatalogTab;
  search?: string;
  includeInactive?: boolean;
};

export type CatalogSummaryItem = {
  id: string;
  organisationId: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
  headUserId: string | null;
  headName: string | null;
  headProfilePicUrl: string | null;
  teamMemberIds: string[];
  activeServiceCount: number;
  activePackageCount: number;
  archivedServiceCount: number;
  archivedPackageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CatalogSpecialityInput = {
  organisationId: string;
  name: string;
  headUserId?: string | null;
  headName?: string | null;
  headProfilePicUrl?: string | null;
  teamMemberIds?: string[];
  isActive?: boolean;
};

export type CatalogSummaryView = {
  organisationId: string;
  items: CatalogSummaryItem[];
};

export type SpecialityCatalogListView = {
  organisationId: string;
  page: number;
  pageSize: number;
  total: number;
  items: CatalogSummaryItem[];
};

export type CatalogSearchItem = {
  id: string;
  organisationId: string;
  specialityId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  kind: ProductKind | "INVENTORY_ITEM";
  source: "CATALOG" | "INVENTORY";
  status: "ACTIVE" | "ARCHIVED";
  isBookable: boolean;
  durationMinutes: number | null;
  unitPrice: number;
  currency: string | null;
  defaultDiscountPercent: number;
  maxDiscountPercent: number;
  totalAmount: number;
  canBeAddedToPackage: boolean;
  blockReason: string | null;
  nestedBreakdown: CatalogPackageBreakdownRow[] | null;
};

export type CatalogSearchResult = {
  query: string | null;
  page: number;
  pageSize: number;
  total: number;
  items: CatalogSearchItem[];
};

export type ArchiveCatalogView = {
  services: CatalogListRow[];
  packages: CatalogListRow[];
};

type ProductPriceRecord = {
  unitPrice: number;
  currency: string | null;
  defaultDiscountPercent: number | null;
  maxDiscountPercent: number | null;
  isDefault: boolean;
};

type ProductRecord = {
  id: string;
  organisationId: string;
  name: string;
  description: string | null;
  code: string | null;
  kind: ProductKind;
  specialityId: string | null;
  legacyServiceId: string | null;
  isActive: boolean;
  version: number;
  prices: ProductPriceRecord[];
  bookable: {
    durationMinutes: number;
    supportsOutpatient: boolean;
    supportsInpatient: boolean;
  } | null;
  package: {
    leadCount: number;
    supportCount: number;
    additionalDiscountPercent: number;
    items: Array<{
      id: string;
      childProductItemId: string;
      quantity: number;
      pricingMode: PackageItemPricingMode;
      overridePrice: number | null;
      discountPercent: number | null;
      sortOrder: number;
      isOptional: boolean;
      childProductItem: {
        id: string;
        name: string;
        code: string | null;
        kind: ProductKind;
        isActive: boolean;
        prices: ProductPriceRecord[];
      };
    }>;
  } | null;
};

export class CatalogServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CatalogServiceError";
  }
}

type CatalogSchedulingContext = {
  productItemId: string;
  organisationId: string;
  durationMinutes: number;
  vetIds: string[];
};

type CatalogCalendarPrefillRequest = {
  organisationId: string;
  date: Date;
  minuteOfDay: number;
  leadId?: string;
  serviceIds: string[];
};

type CatalogCalendarPrefillMatch = {
  serviceId: string;
  slot: {
    startTime: string;
    endTime: string;
    vetIds: string[];
  };
  meta: {
    localStartMinute: number;
    localEndMinute: number;
  };
};

const SLOT_MATCH_TOLERANCE_MINUTES = 5;
const CALENDAR_PREFILL_CACHE_TTL_MS = 15_000;
const CALENDAR_PREFILL_CACHE_MAX_ENTRIES = 2_000;
const CALENDAR_PREFILL_CACHE_PRUNE_INTERVAL_MS = 15_000;
const calendarPrefillCache = new Map<
  string,
  CachedPromise<CatalogCalendarPrefillMatch[]>
>();

export const requireSafeString = (value: unknown, field: string) => {
  if (typeof value !== "string") {
    throw new CatalogServiceError(`${field} is required.`, 400);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new CatalogServiceError(`${field} is required.`, 400);
  }

  if (trimmed.includes("$")) {
    throw new CatalogServiceError(`Invalid ${field}.`, 400);
  }

  return trimmed;
};

export const optionalSafeString = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new CatalogServiceError("Invalid string value.", 400);
  }
  const trimmed = value.trim();
  return trimmed || null;
};

export const resolveCatalogSchedulingContext = async (
  productItemId: string,
  organisationId: string,
): Promise<CatalogSchedulingContext> => {
  const safeProductItemId = requireSafeString(productItemId, "productItemId");
  const safeOrganisationId = requireSafeString(
    organisationId,
    "organisationId",
  );

  const product =
    (
      await prisma.productItem.findMany({
        where: {
          OR: [
            { id: safeProductItemId },
            { legacyServiceId: safeProductItemId },
          ],
          organisationId: safeOrganisationId,
        },
        select: {
          id: true,
          organisationId: true,
          specialityId: true,
          bookable: {
            select: {
              durationMinutes: true,
            },
          },
        },
        take: 1,
      })
    )[0] ?? null;

  if (!product) {
    throw new CatalogServiceError("Product not found.", 404);
  }

  if (!product.bookable) {
    throw new CatalogServiceError("Product is not bookable.", 400);
  }

  if (!product.specialityId) {
    throw new CatalogServiceError("Speciality not found.", 404);
  }

  const speciality = await prisma.speciality.findFirst({
    where: { id: product.specialityId },
    select: { memberUserIds: true },
  });

  if (!speciality) {
    throw new CatalogServiceError("Speciality not found.", 404);
  }

  return {
    productItemId: product.id,
    organisationId: product.organisationId,
    durationMinutes: product.bookable.durationMinutes,
    vetIds: speciality.memberUserIds || [],
  };
};

export const assertPackageItems = (
  kind: ProductKind,
  packageItems: CatalogPackageItemInput[] | null | undefined,
) => {
  if (kind !== "PACKAGE" && packageItems && packageItems.length > 0) {
    throw new CatalogServiceError(
      "Only products with kind PACKAGE can define package items.",
      400,
    );
  }

  if (kind === "PACKAGE" && !packageItems) {
    throw new CatalogServiceError(
      "Package products must include packageItems.",
      400,
    );
  }
};

export const assertBookableConfig = (
  bookable: CatalogBookableInput | null | undefined,
) => {
  if (!bookable) return;

  if (
    !Number.isInteger(bookable.durationMinutes) ||
    bookable.durationMinutes <= 0
  ) {
    throw new CatalogServiceError(
      "Bookable durationMinutes must be a positive integer.",
      400,
    );
  }

  if (
    bookable.supportsOutpatient === false &&
    bookable.supportsInpatient === false
  ) {
    throw new CatalogServiceError(
      "Bookable products must support at least one appointment kind.",
      400,
    );
  }
};

export const assertPriceConfig = (
  price: CatalogPricePolicy | null | undefined,
) => {
  if (!price) return;

  if (price.unitPrice < 0) {
    throw new CatalogServiceError("Price unitPrice cannot be negative.", 400);
  }
  if (
    price.defaultDiscountPercent != null &&
    (price.defaultDiscountPercent < 0 || price.defaultDiscountPercent > 100)
  ) {
    throw new CatalogServiceError(
      "defaultDiscountPercent must be between 0 and 100.",
      400,
    );
  }
  if (
    price.maxDiscountPercent != null &&
    (price.maxDiscountPercent < 0 || price.maxDiscountPercent > 100)
  ) {
    throw new CatalogServiceError(
      "maxDiscountPercent must be between 0 and 100.",
      400,
    );
  }
  if (
    price.defaultDiscountPercent != null &&
    price.maxDiscountPercent != null &&
    price.defaultDiscountPercent > price.maxDiscountPercent
  ) {
    throw new CatalogServiceError(
      "defaultDiscountPercent cannot exceed maxDiscountPercent.",
      400,
    );
  }
};

export const sanitizePackageItems = (
  packageItems: CatalogPackageItemInput[] | null | undefined,
) => {
  if (!packageItems) return null;

  return packageItems.map((item, index) => {
    const childProductItemId = requireSafeString(
      item.childProductItemId,
      `packageItems[${index}].childProductItemId`,
    );

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new CatalogServiceError(
        `packageItems[${index}].quantity must be a positive integer.`,
        400,
      );
    }

    if (
      item.pricingMode === "OVERRIDE_PRICE" &&
      (item.overridePrice == null || item.overridePrice < 0)
    ) {
      throw new CatalogServiceError(
        `packageItems[${index}].overridePrice is required for OVERRIDE_PRICE.`,
        400,
      );
    }

    if (
      item.discountPercent != null &&
      (item.discountPercent < 0 || item.discountPercent > 100)
    ) {
      throw new CatalogServiceError(
        `packageItems[${index}].discountPercent must be between 0 and 100.`,
        400,
      );
    }

    return {
      childProductItemId,
      quantity: item.quantity,
      pricingMode: item.pricingMode,
      overridePrice: item.overridePrice ?? null,
      discountPercent: item.discountPercent ?? null,
      sortOrder: item.sortOrder ?? index,
      isOptional: item.isOptional ?? false,
    };
  });
};

const PRODUCT_CODE_PREFIXES: Record<ProductKind, string> = {
  CONSULTATION: "CS",
  PROCEDURE: "PR",
  DIAGNOSTIC: "DX",
  MEDICATION: "MD",
  INVENTORY_ITEM: "IV",
  LAB_TEST: "LB",
  PACKAGE: "PK",
};

const MAX_PACKAGE_NESTING_DEPTH = 3;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

export const ensureSpecialityExists = async (
  organisationId: string,
  specialityId: string | null,
) => {
  if (!specialityId) return;

  const speciality = await prisma.speciality.findFirst({
    where: {
      id: specialityId,
      organisationId,
    },
    select: { id: true },
  });

  if (!speciality) {
    throw new CatalogServiceError(
      "Speciality not found for the organisation.",
      404,
      "NOT_FOUND",
    );
  }
};

export const ensureCodeUniqueness = async (params: {
  organisationId: string;
  code: string;
  excludeProductId?: string;
}) => {
  const existing = await prisma.productItem.findFirst({
    where: {
      organisationId: params.organisationId,
      code: params.code,
      ...(params.excludeProductId
        ? { NOT: { id: params.excludeProductId } }
        : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new CatalogServiceError(
      "Catalog code already exists in this organisation.",
      409,
      "DUPLICATE_CATALOG_CODE",
      { code: params.code },
    );
  }
};

export const assertCatalogVersion = (params: {
  currentVersion: number;
  expectedVersion?: number;
  resourceName: string;
}) => {
  if (
    params.expectedVersion != null &&
    params.expectedVersion !== params.currentVersion
  ) {
    throw new CatalogServiceError(
      `${params.resourceName} has changed since it was last loaded.`,
      409,
      "VERSION_CONFLICT",
      {
        expectedVersion: params.expectedVersion,
        currentVersion: params.currentVersion,
      },
    );
  }
};

export const generateProductCode = async (
  organisationId: string,
  kind: ProductKind,
): Promise<string> => {
  const prefix = PRODUCT_CODE_PREFIXES[kind];
  const codes = await prisma.productItem.findMany({
    where: {
      organisationId,
      code: {
        startsWith: `${prefix}-`,
      },
    },
    select: { code: true },
  });

  const matcher = new RegExp(String.raw`^${escapeRegExp(prefix)}-(\d+)$`);
  const maxValue = codes.reduce((max, row) => {
    const match = row.code ? matcher.exec(row.code) : null;
    if (!match) return max;
    const parsed = Number.parseInt(match[1] ?? "0", 10);
    return Number.isFinite(parsed) && parsed > max ? parsed : max;
  }, 0);

  return `${prefix}-${String(maxValue + 1).padStart(4, "0")}`;
};

export const buildPackageGraph = async (organisationId: string) => {
  const products = await prisma.productItem.findMany({
    where: {
      organisationId,
      kind: "PACKAGE",
    },
    include: {
      package: {
        include: {
          items: {
            select: {
              childProductItemId: true,
            },
          },
        },
      },
    },
  });

  const graph = new Map<string, string[]>();
  for (const product of products) {
    graph.set(
      product.id,
      product.package?.items.map((item) => item.childProductItemId) ?? [],
    );
  }

  return graph;
};

export const getPackageDepth = (
  graph: Map<string, string[]>,
  productId: string,
  visited = new Set<string>(),
): number => {
  if (visited.has(productId)) return MAX_PACKAGE_NESTING_DEPTH + 1;
  visited.add(productId);

  const children = graph.get(productId) ?? [];
  let maxDepth = 1;
  for (const childId of children) {
    if (!graph.has(childId)) continue;
    maxDepth = Math.max(
      maxDepth,
      1 + getPackageDepth(graph, childId, new Set(visited)),
    );
  }

  return maxDepth;
};

export const packageContainsTarget = (
  graph: Map<string, string[]>,
  packageId: string,
  targetId: string,
  visited = new Set<string>(),
): boolean => {
  if (visited.has(packageId)) return false;
  visited.add(packageId);

  const children = graph.get(packageId) ?? [];
  for (const childId of children) {
    if (childId === targetId) return true;
    if (
      graph.has(childId) &&
      packageContainsTarget(graph, childId, targetId, visited)
    ) {
      return true;
    }
  }

  return false;
};

export const ensureProductDeletionAllowed = async (
  productId: string,
  organisationId?: string,
) => {
  const [packageDependency, appointments, invoices] = await Promise.all([
    prisma.productPackageItem.findFirst({
      where: {
        childProductItemId: productId,
        ...(organisationId
          ? {
              package: {
                productItem: {
                  organisationId,
                },
              },
            }
          : {}),
      },
      select: { id: true, packageId: true },
    }),
    prisma.appointment.count({
      where: {
        productItemId: productId,
        ...(organisationId ? { organisationId } : {}),
      },
    }),
    prisma.invoice.findMany({
      where: {
        ...(organisationId ? { organisationId } : {}),
      },
      select: {
        id: true,
        items: true,
      },
    }),
  ]);

  const invoiceUsageCount = invoices.filter((invoice) => {
    if (!Array.isArray(invoice.items)) return false;
    return invoice.items.some((item) => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return (
        record.productItemId === productId ||
        record.packageProductItemId === productId
      );
    });
  }).length;

  if (packageDependency || appointments > 0 || invoiceUsageCount > 0) {
    throw new CatalogServiceError(
      "Catalog item cannot be permanently deleted because it has dependencies.",
      409,
      "CATALOG_ITEM_HAS_DEPENDENCIES",
      {
        packageDependencies: packageDependency ? 1 : 0,
        appointments,
        invoices: invoiceUsageCount,
      },
    );
  }
};

export const mapSpecialitySummaries = (params: {
  specialities: Array<{
    id: string;
    organisationId: string;
    name: string;
    headUserId: string | null;
    headName: string | null;
    headProfilePicUrl: string | null;
    memberUserIds: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  products: Array<{
    specialityId: string | null;
    isActive: boolean;
    kind: ProductKind;
    name: string;
    code: string | null;
    description: string | null;
  }>;
  search?: string | null;
}) => {
  const search = params.search?.trim().toLowerCase() ?? null;

  return params.specialities
    .map<CatalogSummaryItem>((speciality) => {
      const products = params.products.filter(
        (product) => product.specialityId === speciality.id,
      );
      const activeServices = products.filter(
        (product) => product.kind !== "PACKAGE" && product.isActive,
      ).length;
      const activePackages = products.filter(
        (product) => product.kind === "PACKAGE" && product.isActive,
      ).length;
      const archivedServices = products.filter(
        (product) => product.kind !== "PACKAGE" && !product.isActive,
      ).length;
      const archivedPackages = products.filter(
        (product) => product.kind === "PACKAGE" && !product.isActive,
      ).length;

      return {
        id: speciality.id,
        organisationId: speciality.organisationId,
        name: speciality.name,
        status: speciality.isActive ? "ACTIVE" : "ARCHIVED",
        headUserId: speciality.headUserId,
        headName: speciality.headName,
        headProfilePicUrl: speciality.headProfilePicUrl,
        teamMemberIds: Array.from(
          new Set([
            ...speciality.memberUserIds,
            ...(speciality.headUserId ? [speciality.headUserId] : []),
          ]),
        ),
        activeServiceCount: activeServices,
        activePackageCount: activePackages,
        archivedServiceCount: archivedServices,
        archivedPackageCount: archivedPackages,
        createdAt: speciality.createdAt,
        updatedAt: speciality.updatedAt,
      };
    })
    .filter((item) => {
      if (!search) return true;

      const productMatches = params.products.some((product) => {
        if (product.specialityId !== item.id) return false;
        const haystack = [
          product.name,
          product.code ?? "",
          product.description ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });

      const specialityText = [item.name, item.headName ?? ""]
        .join(" ")
        .toLowerCase();

      return specialityText.includes(search) || productMatches;
    })
    .filter((item) => item.status === "ACTIVE" || item.status === "ARCHIVED")
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const sanitizeTeamMemberIds = (value: unknown): string[] => {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new CatalogServiceError("teamMemberIds must be an array.", 400);
  }

  return value.map((entry, index) =>
    requireSafeString(entry, `teamMemberIds[${index}]`),
  );
};

export const ensureSpecialityNameUnique = async (params: {
  organisationId: string;
  name: string;
  excludeId?: string;
}) => {
  const existing = await prisma.speciality.findFirst({
    where: {
      organisationId: params.organisationId,
      name: {
        equals: params.name,
        mode: "insensitive",
      },
      ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new CatalogServiceError(
      "Speciality name already exists in this organisation.",
      409,
      "DUPLICATE_SPECIALITY_NAME",
      { name: params.name },
    );
  }
};

export const ensurePackageItemsValid = async (params: {
  organisationId: string;
  packageItems: CatalogPackageItemInput[];
  currentProductId?: string;
}) => {
  const uniqueIds = Array.from(
    new Set(params.packageItems.map((item) => item.childProductItemId)),
  );

  if (!uniqueIds.length) {
    throw new CatalogServiceError(
      "Package products must include at least one package item.",
      400,
      "VALIDATION_ERROR",
    );
  }

  const childProducts = await prisma.productItem.findMany({
    where: {
      organisationId: params.organisationId,
      id: { in: uniqueIds },
    },
    include: {
      prices: true,
      package: {
        include: {
          items: {
            select: {
              childProductItemId: true,
            },
          },
        },
      },
    },
  });

  if (childProducts.length !== uniqueIds.length) {
    throw new CatalogServiceError(
      "One or more package child items are unavailable.",
      409,
      "PACKAGE_CHILD_UNAVAILABLE",
    );
  }

  const childMap = new Map(
    childProducts.map((product) => [product.id, product]),
  );
  for (const item of params.packageItems) {
    assertPackageItemValid(item, childMap, params.currentProductId);
  }

  const graph = await buildPackageGraph(params.organisationId);
  if (params.currentProductId) {
    graph.set(
      params.currentProductId,
      params.packageItems.map((item) => item.childProductItemId),
    );
  }

  for (const item of params.packageItems) {
    assertPackageGraphItemValid(item, graph, params.currentProductId);
  }

  if (params.currentProductId) {
    const depth = getPackageDepth(graph, params.currentProductId);
    if (depth > MAX_PACKAGE_NESTING_DEPTH) {
      throw new CatalogServiceError(
        `Package nesting depth cannot exceed ${MAX_PACKAGE_NESTING_DEPTH}.`,
        409,
        "PACKAGE_HAS_CYCLE",
        { maxDepth: MAX_PACKAGE_NESTING_DEPTH },
      );
    }
  }
};

const assertPackageItemValid = (
  item: CatalogPackageItemInput,
  childMap: Map<string, { isActive: boolean; prices: ProductPriceRecord[] }>,
  currentProductId?: string,
) => {
  const child = childMap.get(item.childProductItemId);
  if (!child?.isActive) {
    throw new CatalogServiceError(
      "One or more package child items are unavailable.",
      409,
      "PACKAGE_CHILD_UNAVAILABLE",
      { childProductItemId: item.childProductItemId },
    );
  }
  if (currentProductId && item.childProductItemId === currentProductId) {
    throw new CatalogServiceError(
      "Package cannot include itself.",
      409,
      "PACKAGE_HAS_CYCLE",
    );
  }

  if (item.discountPercent != null) {
    const childPrice = getDefaultPrice(child.prices);
    const maxDiscountPercent = childPrice?.maxDiscountPercent ?? 0;
    if (item.discountPercent > maxDiscountPercent) {
      throw new CatalogServiceError(
        "Package item discountPercent cannot exceed the child item's max discount.",
        409,
        "PACKAGE_ITEM_DISCOUNT_TOO_HIGH",
        {
          childProductItemId: item.childProductItemId,
          maxDiscountPercent,
        },
      );
    }
  }
};

const assertPackageGraphItemValid = (
  item: CatalogPackageItemInput,
  graph: Map<string, string[]>,
  currentProductId?: string,
) => {
  if (!graph.has(item.childProductItemId)) return;
  if (
    currentProductId &&
    packageContainsTarget(graph, item.childProductItemId, currentProductId)
  ) {
    throw new CatalogServiceError(
      "Package composition would create a cycle.",
      409,
      "PACKAGE_HAS_CYCLE",
    );
  }
};

export const ensureSpecialityDeletionAllowed = async (
  specialityId: string,
  organisationId: string,
) => {
  const [products, appointments, matchingAppointments] = await Promise.all([
    prisma.productItem.findMany({
      where: {
        organisationId,
        specialityId,
      },
      select: {
        id: true,
        isActive: true,
        kind: true,
      },
    }),
    prisma.appointment.count({
      where: {
        organisationId,
        appointmentType: {
          path: ["speciality", "id"],
          equals: specialityId,
        },
      },
    }),
    prisma.appointment.findMany({
      where: {
        organisationId,
        appointmentType: {
          path: ["speciality", "id"],
          equals: specialityId,
        },
      },
      select: {
        id: true,
      },
    }),
  ]);

  const invoiceUsageCount = matchingAppointments.length
    ? await prisma.invoice.count({
        where: {
          organisationId,
          appointmentId: {
            in: matchingAppointments.map((appointment) => appointment.id),
          },
        },
      })
    : 0;

  const dependencyDetails = {
    activeServices: products.filter(
      (item) => item.kind !== "PACKAGE" && item.isActive,
    ).length,
    archivedServices: products.filter(
      (item) => item.kind !== "PACKAGE" && !item.isActive,
    ).length,
    activePackages: products.filter(
      (item) => item.kind === "PACKAGE" && item.isActive,
    ).length,
    archivedPackages: products.filter(
      (item) => item.kind === "PACKAGE" && !item.isActive,
    ).length,
    appointments,
    invoices: invoiceUsageCount,
  };

  if (Object.values(dependencyDetails).some((value) => value > 0)) {
    throw new CatalogServiceError(
      "Speciality cannot be permanently deleted because it has catalog items or historical usage.",
      409,
      "SPECIALITY_HAS_DEPENDENCIES",
      dependencyDetails,
    );
  }
};

const mapProductRecordToView = (product: ProductRecord): CatalogProductView => {
  const defaultPrice = getDefaultPrice(product.prices);
  const packageBreakdown =
    product.kind === "PACKAGE" && product.package?.items.length
      ? product.package.items.map(buildPackageBreakdownRow)
      : [];
  const packageSummary =
    product.kind === "PACKAGE" && product.package
      ? computePackageFinancials({
          product,
          items: packageBreakdown,
        })
      : null;

  return {
    id: product.id,
    version: product.version,
    organisationId: product.organisationId,
    name: product.name,
    description: product.description,
    code: product.code,
    kind: product.kind,
    specialityId: product.specialityId,
    legacyServiceId: product.legacyServiceId,
    isActive: product.isActive,
    defaultPrice: defaultPrice
      ? {
          unitPrice: defaultPrice.unitPrice,
          currency: defaultPrice.currency,
          defaultDiscountPercent: defaultPrice.defaultDiscountPercent,
          maxDiscountPercent: defaultPrice.maxDiscountPercent,
          isDefault: defaultPrice.isDefault,
        }
      : null,
    bookable: product.bookable
      ? {
          durationMinutes: product.bookable.durationMinutes,
          supportsOutpatient: product.bookable.supportsOutpatient,
          supportsInpatient: product.bookable.supportsInpatient,
        }
      : null,
    package: packageSummary,
    packageItems: packageBreakdown.map((item) => ({
      id: item.id,
      childProductItemId: item.childItemId,
      childProductName: item.childItemName,
      childProductKind: item.childItemKind,
      childProductCode: item.childItemCode ?? null,
      quantity: item.quantity,
      pricingMode: item.pricingMode,
      overridePrice: item.overridePrice,
      discountPercent: item.discountPercent,
      sortOrder: item.sortOrder,
      isOptional: item.isOptional,
      currency: item.currency,
      grossAmount: item.grossAmount,
      discountAmount: item.discountAmount,
      finalAmount: item.finalAmount,
    })),
  };
};

type ProductPackageItemRecord = NonNullable<
  ProductRecord["package"]
>["items"][number];

const mapProductRecordToCatalogListRow = (
  product: ProductRecord,
): CatalogListRow => {
  const defaultPrice = getDefaultPrice(product.prices);
  const durationMinutes = product.bookable?.durationMinutes ?? null;
  const unitPrice = defaultPrice?.unitPrice ?? null;
  const defaultDiscountPercent = defaultPrice?.defaultDiscountPercent ?? null;
  const maxDiscountPercent = defaultPrice?.maxDiscountPercent ?? null;

  const packageBreakdown =
    product.kind === "PACKAGE" && product.package?.items.length
      ? product.package.items.map(buildPackageBreakdownRow)
      : [];
  const packageSummary =
    product.kind === "PACKAGE" && product.package
      ? computePackageFinancials({
          product,
          items: packageBreakdown,
        })
      : null;

  const totalAmount =
    product.kind === "PACKAGE"
      ? (packageSummary?.finalAmount ?? 0)
      : unitPrice != null
        ? computeLineAmounts({
            unitPrice,
            quantity: 1,
            discountPercent: defaultDiscountPercent ?? 0,
          }).finalAmount
        : 0;

  return {
    id: product.id,
    version: product.version,
    code: product.code,
    name: product.name,
    description: product.description,
    kind: product.kind,
    isBookable: Boolean(product.bookable),
    isActive: product.isActive,
    durationMinutes,
    unitPrice,
    defaultDiscountPercent,
    maxDiscountPercent,
    totalAmount,
    leadCount: packageSummary?.leadCount ?? null,
    supportCount: packageSummary?.supportCount ?? null,
    additionalDiscountPercent:
      packageSummary?.additionalDiscountPercent ?? null,
    grossAmount: packageSummary?.grossAmount ?? null,
    itemDiscountAmount: packageSummary?.itemDiscountAmount ?? null,
    additionalDiscountAmount: packageSummary?.additionalDiscountAmount ?? null,
    breakdownItemCount: packageSummary?.breakdownItemCount ?? null,
    currency: defaultPrice?.currency ?? packageBreakdown[0]?.currency ?? null,
  };
};

const mapPackageRecordToDetail = (
  product: ProductRecord,
): CatalogPackageDetail => {
  if (product.kind !== "PACKAGE") {
    throw new CatalogServiceError("Product is not a package.", 400);
  }

  const defaultPrice = getDefaultPrice(product.prices);
  const items: CatalogPackageBreakdownRow[] =
    product.package?.items.map(buildPackageBreakdownRow) ?? [];
  const packageSummary = computePackageFinancials({
    product,
    items,
  });

  return {
    id: product.id,
    version: product.version,
    code: product.code,
    name: product.name,
    description: product.description,
    isBookable: Boolean(product.bookable),
    isActive: product.isActive,
    durationMinutes: product.bookable?.durationMinutes ?? null,
    maxDiscountPercent: defaultPrice?.maxDiscountPercent ?? null,
    leadCount: packageSummary.leadCount,
    supportCount: packageSummary.supportCount,
    additionalDiscountPercent: packageSummary.additionalDiscountPercent,
    grossAmount: packageSummary.grossAmount,
    itemDiscountAmount: packageSummary.itemDiscountAmount,
    additionalDiscountAmount: packageSummary.additionalDiscountAmount,
    breakdownItemCount: packageSummary.breakdownItemCount,
    currency: defaultPrice?.currency ?? items[0]?.currency ?? null,
    totalAmount: packageSummary.finalAmount,
    items,
  };
};

const toAppointmentKinds = (
  bookable: ProductRecord["bookable"],
): AppointmentKind[] => {
  if (!bookable) return [];

  const kinds: AppointmentKind[] = [];
  if (bookable.supportsOutpatient) kinds.push("OUTPATIENT");
  if (bookable.supportsInpatient) kinds.push("INPATIENT");
  return kinds;
};

const getDefaultPrice = (prices: ProductPriceRecord[]) =>
  prices.find((price) => price.isDefault) ?? prices[0] ?? null;

const computeLineAmounts = (params: {
  unitPrice: number;
  quantity: number;
  discountPercent?: number | null;
}) => {
  const grossAmount = params.unitPrice * params.quantity;
  const discountPercent = params.discountPercent ?? 0;
  const discountAmount = grossAmount * (discountPercent / 100);
  const finalAmount = grossAmount - discountAmount;

  return {
    grossAmount,
    discountPercent,
    discountAmount,
    finalAmount,
  };
};

const computePackageFinancials = (params: {
  product: ProductRecord;
  items: CatalogPackageBreakdownRow[];
}) => {
  const grossAmount = params.items.reduce(
    (sum, item) => sum + item.grossAmount,
    0,
  );
  const itemDiscountAmount = params.items.reduce(
    (sum, item) => sum + item.discountAmount,
    0,
  );
  const additionalDiscountPercent =
    params.product.package?.additionalDiscountPercent ?? 0;
  const additionalDiscountAmount =
    (grossAmount - itemDiscountAmount) * (additionalDiscountPercent / 100);
  const finalAmount =
    grossAmount - itemDiscountAmount - additionalDiscountAmount;

  return {
    leadCount: params.product.package?.leadCount ?? 1,
    supportCount: params.product.package?.supportCount ?? 0,
    additionalDiscountPercent,
    grossAmount,
    itemDiscountAmount,
    additionalDiscountAmount,
    breakdownItemCount: params.items.length,
    finalAmount,
  };
};

const buildPackageBreakdownRow = (item: ProductPackageItemRecord) => {
  const childPrice = getDefaultPrice(item.childProductItem.prices);
  const baseUnitPrice =
    item.pricingMode === "OVERRIDE_PRICE"
      ? (item.overridePrice ?? 0)
      : (childPrice?.unitPrice ?? 0);
  const effectiveDiscountPercent =
    item.pricingMode === "INCLUDED"
      ? 0
      : (item.discountPercent ?? childPrice?.defaultDiscountPercent ?? 0);
  const amounts = computeLineAmounts({
    unitPrice: item.pricingMode === "INCLUDED" ? 0 : baseUnitPrice,
    quantity: item.quantity,
    discountPercent: effectiveDiscountPercent,
  });

  return {
    id: item.id,
    type: item.childProductItem.kind,
    childItemId: item.childProductItem.id,
    childItemKind: item.childProductItem.kind,
    childItemCode: item.childProductItem.code ?? null,
    name: item.childProductItem.name,
    childItemName: item.childProductItem.name,
    quantity: item.quantity,
    unitPrice: item.pricingMode === "INCLUDED" ? 0 : baseUnitPrice,
    currency: childPrice?.currency ?? null,
    grossAmount: amounts.grossAmount,
    discountPercent: effectiveDiscountPercent,
    discountAmount: amounts.discountAmount,
    finalAmount: amounts.finalAmount,
    pricingMode: item.pricingMode,
    overridePrice: item.overridePrice,
    isOptional: item.isOptional,
    sortOrder: item.sortOrder,
  } satisfies CatalogPackageBreakdownRow;
};

const buildResolvedItem = (params: {
  productItemId: string;
  code?: string | null;
  name: string;
  kind: ProductKind;
  quantity: number;
  unitPrice: number;
  currency?: string | null;
  referenceUnitPrice?: number | null;
  defaultDiscountPercent?: number | null;
  maxDiscountPercent?: number | null;
  discountPercent?: number | null;
  isPackageComponent: boolean;
  packageProductItemId?: string | null;
}): ResolvedCatalogItem => ({
  productItemId: params.productItemId,
  code: params.code ?? null,
  name: params.name,
  kind: params.kind,
  quantity: params.quantity,
  currency: params.currency ?? null,
  unitPrice: params.unitPrice,
  referenceUnitPrice: params.referenceUnitPrice ?? null,
  defaultDiscountPercent: params.defaultDiscountPercent ?? null,
  maxDiscountPercent: params.maxDiscountPercent ?? null,
  discountPercent: params.discountPercent ?? 0,
  grossAmount: params.unitPrice * params.quantity,
  discountAmount:
    params.unitPrice * params.quantity * ((params.discountPercent ?? 0) / 100),
  finalAmount:
    params.unitPrice * params.quantity -
    params.unitPrice * params.quantity * ((params.discountPercent ?? 0) / 100),
  isPackageComponent: params.isPackageComponent,
  packageProductItemId: params.packageProductItemId ?? null,
});

const resolveSelectionTemplateKinds = (params: {
  productKind: ProductKind;
  appointmentKinds: AppointmentKind[];
}): TemplateKind[] => {
  if (params.productKind === "MEDICATION") {
    return ["PRESCRIPTION"];
  }

  if (params.productKind === "PACKAGE") {
    if (params.appointmentKinds.includes("INPATIENT")) {
      return [
        "TASK_ASSIGNMENT",
        "INPATIENT_SCHEDULE",
        "SOAP_NOTE",
        "DISCHARGE_SUMMARY",
      ];
    }

    return ["TASK_ASSIGNMENT", "SOAP_NOTE"];
  }

  return ["SOAP_NOTE"];
};

const resolveNonPackageCatalogSelection = (params: {
  product: ProductRecord;
  parentPrice: ReturnType<typeof getDefaultPrice>;
  appointmentKinds: AppointmentKind[];
  isBookable: boolean;
  templateKinds: TemplateKind[];
  templateBindings: CatalogTemplateBinding[];
}) => {
  const parentAmounts = computeLineAmounts({
    unitPrice: params.parentPrice?.unitPrice ?? 0,
    quantity: 1,
    discountPercent: params.parentPrice?.defaultDiscountPercent ?? 0,
  });

  return {
    productItemId: params.product.id,
    productKind: params.product.kind,
    name: params.product.name,
    code: params.product.code,
    currency: params.parentPrice?.currency ?? null,
    legacyServiceId: params.product.legacyServiceId,
    isBookable: params.isBookable,
    appointmentKinds: params.appointmentKinds,
    leadCount: null,
    supportCount: null,
    additionalDiscountPercent: null,
    grossAmount: parentAmounts.grossAmount,
    itemDiscountAmount: parentAmounts.discountAmount,
    additionalDiscountAmount: 0,
    finalAmount: parentAmounts.finalAmount,
    breakdownItemCount: 1,
    templateKinds: params.templateKinds,
    templateBindings: params.templateBindings,
    billingItems: [
      buildResolvedItem({
        productItemId: params.product.id,
        code: params.product.code,
        name: params.product.name,
        kind: params.product.kind,
        quantity: 1,
        unitPrice: params.parentPrice?.unitPrice ?? 0,
        currency: params.parentPrice?.currency ?? null,
        defaultDiscountPercent:
          params.parentPrice?.defaultDiscountPercent ?? null,
        maxDiscountPercent: params.parentPrice?.maxDiscountPercent ?? null,
        discountPercent: params.parentPrice?.defaultDiscountPercent ?? 0,
        isPackageComponent: false,
      }),
    ],
    includedItems: [],
  };
};

const resolvePackageCatalogSelection = (params: {
  product: ProductRecord;
  parentPrice: ReturnType<typeof getDefaultPrice>;
  appointmentKinds: AppointmentKind[];
  isBookable: boolean;
  templateKinds: TemplateKind[];
  templateBindings: CatalogTemplateBinding[];
}) => {
  if (!params.product.package) {
    throw new CatalogServiceError(
      "Package product is missing package configuration.",
      500,
    );
  }

  const billingItems: ResolvedCatalogItem[] = [
    buildResolvedItem({
      productItemId: params.product.id,
      code: params.product.code,
      name: params.product.name,
      kind: params.product.kind,
      quantity: 1,
      unitPrice: params.parentPrice?.unitPrice ?? 0,
      currency: params.parentPrice?.currency ?? null,
      defaultDiscountPercent:
        params.parentPrice?.defaultDiscountPercent ?? null,
      maxDiscountPercent: params.parentPrice?.maxDiscountPercent ?? null,
      discountPercent: params.parentPrice?.defaultDiscountPercent ?? 0,
      isPackageComponent: false,
    }),
  ];
  const includedItems: ResolvedCatalogItem[] = [];

  for (const item of params.product.package.items) {
    if (!item.childProductItem.isActive) {
      throw new CatalogServiceError(
        `Package component ${item.childProductItem.name} is inactive.`,
        400,
      );
    }

    const childPrice = getDefaultPrice(item.childProductItem.prices);

    if (item.pricingMode === "INCLUDED") {
      includedItems.push(
        buildResolvedItem({
          productItemId: item.childProductItem.id,
          code: item.childProductItem.code,
          name: item.childProductItem.name,
          kind: item.childProductItem.kind,
          quantity: item.quantity,
          unitPrice: 0,
          currency: childPrice?.currency ?? null,
          referenceUnitPrice: childPrice?.unitPrice ?? null,
          defaultDiscountPercent: childPrice?.defaultDiscountPercent ?? null,
          maxDiscountPercent: childPrice?.maxDiscountPercent ?? null,
          discountPercent: 0,
          isPackageComponent: true,
          packageProductItemId: params.product.id,
        }),
      );
      continue;
    }

    if (item.pricingMode === "OVERRIDE_PRICE" && item.overridePrice == null) {
      throw new CatalogServiceError(
        `Package component ${item.childProductItem.name} is missing override price.`,
        500,
      );
    }

    if (item.pricingMode === "INHERITED_PRICE" && !childPrice) {
      throw new CatalogServiceError(
        `Package component ${item.childProductItem.name} is missing default price.`,
        500,
      );
    }

    billingItems.push(
      buildResolvedItem({
        productItemId: item.childProductItem.id,
        code: item.childProductItem.code,
        name: item.childProductItem.name,
        kind: item.childProductItem.kind,
        quantity: item.quantity,
        unitPrice:
          item.pricingMode === "OVERRIDE_PRICE"
            ? (item.overridePrice as number)
            : (childPrice?.unitPrice ?? 0),
        currency: childPrice?.currency ?? null,
        referenceUnitPrice: childPrice?.unitPrice ?? null,
        defaultDiscountPercent: childPrice?.defaultDiscountPercent ?? null,
        maxDiscountPercent: childPrice?.maxDiscountPercent ?? null,
        discountPercent:
          item.discountPercent ?? childPrice?.defaultDiscountPercent ?? 0,
        isPackageComponent: true,
        packageProductItemId: params.product.id,
      }),
    );
  }

  const grossAmount = billingItems.reduce(
    (sum, item) => sum + item.grossAmount,
    0,
  );
  const itemDiscountAmount = billingItems.reduce(
    (sum, item) => sum + item.discountAmount,
    0,
  );
  const packageDiscountPercent =
    params.product.package.additionalDiscountPercent ?? 0;
  const additionalDiscountAmount =
    (grossAmount - itemDiscountAmount) * (packageDiscountPercent / 100);
  const finalAmount =
    grossAmount - itemDiscountAmount - additionalDiscountAmount;
  const currency =
    params.parentPrice?.currency ??
    billingItems.find((item) => item.currency != null)?.currency ??
    null;

  return {
    productItemId: params.product.id,
    productKind: params.product.kind,
    name: params.product.name,
    code: params.product.code,
    currency,
    legacyServiceId: params.product.legacyServiceId,
    isBookable: params.isBookable,
    appointmentKinds: params.appointmentKinds,
    leadCount: params.product.package.leadCount ?? 1,
    supportCount: params.product.package.supportCount ?? 0,
    additionalDiscountPercent: packageDiscountPercent,
    grossAmount,
    itemDiscountAmount,
    additionalDiscountAmount,
    finalAmount,
    breakdownItemCount: billingItems.length + includedItems.length,
    templateKinds: params.templateKinds,
    templateBindings: params.templateBindings,
    billingItems,
    includedItems,
  };
};

export const resolveCatalogSelectionFromRecord = (
  product: ProductRecord,
  templateBindings: CatalogTemplateBinding[] = [],
): ResolvedCatalogSelection => {
  if (!product.isActive) {
    throw new CatalogServiceError("Selected product is inactive.", 400);
  }

  const appointmentKinds = toAppointmentKinds(product.bookable);
  const parentPrice = getDefaultPrice(product.prices);
  const isBookable = appointmentKinds.length > 0;
  const templateKinds = resolveSelectionTemplateKinds({
    productKind: product.kind,
    appointmentKinds,
  });

  if (product.kind !== "PACKAGE") {
    return resolveNonPackageCatalogSelection({
      product,
      parentPrice,
      appointmentKinds,
      isBookable,
      templateKinds,
      templateBindings,
    });
  }

  return resolvePackageCatalogSelection({
    product,
    parentPrice,
    appointmentKinds,
    isBookable,
    templateKinds,
    templateBindings,
  });
};

const productSelectionInclude = {
  prices: {
    orderBy: [{ isDefault: "desc" as const }],
  },
  bookable: {
    select: {
      durationMinutes: true,
      supportsOutpatient: true,
      supportsInpatient: true,
    },
  },
  package: {
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" as const }],
        include: {
          childProductItem: {
            include: {
              prices: {
                orderBy: [{ isDefault: "desc" as const }],
              },
            },
          },
        },
      },
    },
  },
};

const loadTemplateBindingsForProduct = async (params: {
  productItemId: string;
  templateKinds: TemplateKind[];
}) => {
  if (params.templateKinds.length === 0) {
    return [];
  }

  const links = await prisma.templateCatalogLink.findMany({
    where: {
      catalogItemId: params.productItemId,
      template: {
        kind: {
          in: params.templateKinds.map(toLegacyTemplateKind),
        },
      },
    },
    include: {
      template: {
        select: {
          id: true,
          kind: true,
          latestVersion: true,
          publishedVersion: true,
        },
      },
    },
  });

  return links.map<CatalogTemplateBinding>((link) => ({
    templateKind: normalizeTemplateKind(link.template.kind),
    templateId: link.template.id,
    templateVersion:
      link.template.publishedVersion ?? link.template.latestVersion,
  }));
};

export const CatalogService = {
  async createProduct(input: CatalogProductUpsertInput) {
    const organisationId = requireSafeString(
      input.organisationId,
      "organisationId",
    );
    const name = requireSafeString(input.name, "name");
    const description = optionalSafeString(input.description);
    const code = optionalSafeString(input.code);
    const specialityId = optionalSafeString(input.specialityId);
    const legacyServiceId = optionalSafeString(input.legacyServiceId);
    const packageItems = sanitizePackageItems(input.packageItems);
    const packageSummary = input.package ?? null;

    assertPackageItems(input.kind, packageItems);
    assertBookableConfig(input.bookable);
    assertPriceConfig(input.price);
    await ensureSpecialityExists(organisationId, specialityId);
    if (input.kind === "PACKAGE" && packageItems) {
      await ensurePackageItemsValid({
        organisationId,
        packageItems,
      });
    }

    const resolvedCode =
      code ?? (await generateProductCode(organisationId, input.kind));
    await ensureCodeUniqueness({
      organisationId,
      code: resolvedCode,
    });

    const createData = {
      organisationId,
      name,
      description: description ?? undefined,
      code: resolvedCode,
      kind: input.kind,
      specialityId: specialityId ?? undefined,
      legacyServiceId: legacyServiceId ?? undefined,
      isActive: input.isActive ?? true,
      prices: input.price
        ? {
            create: {
              unitPrice: input.price.unitPrice,
              currency: input.price.currency ?? undefined,
              defaultDiscountPercent:
                input.price.defaultDiscountPercent ?? undefined,
              maxDiscountPercent: input.price.maxDiscountPercent ?? undefined,
              isDefault: true,
            },
          }
        : undefined,
      bookable: input.bookable
        ? {
            create: {
              durationMinutes: input.bookable.durationMinutes,
              supportsOutpatient: input.bookable.supportsOutpatient ?? true,
              supportsInpatient: input.bookable.supportsInpatient ?? false,
            },
          }
        : undefined,
      package:
        input.kind === "PACKAGE"
          ? {
              create: {
                leadCount: packageSummary?.leadCount ?? 1,
                supportCount: packageSummary?.supportCount ?? 0,
                additionalDiscountPercent:
                  packageSummary?.additionalDiscountPercent ?? 0,
                items:
                  packageItems && packageItems.length > 0
                    ? {
                        create: packageItems,
                      }
                    : undefined,
              } satisfies Prisma.ProductPackageCreateWithoutProductItemInput,
            }
          : undefined,
    } satisfies Prisma.ProductItemCreateInput;

    const created = (await prisma.productItem.create({
      data: createData,
      include: productSelectionInclude,
    })) as unknown as ProductRecord;

    return mapProductRecordToView(created);
  },

  async updateProduct(
    id: string,
    input: Partial<CatalogProductUpsertInput> & { expectedVersion?: number },
  ) {
    const productId = requireSafeString(id, "productId");
    const existing = await prisma.productItem.findUnique({
      where: { id: productId },
      include: {
        prices: true,
        bookable: true,
        package: { include: { items: true } },
      },
    });

    if (!existing) {
      throw new CatalogServiceError("Product not found.", 404);
    }
    assertCatalogVersion({
      currentVersion: existing.version,
      expectedVersion: input.expectedVersion,
      resourceName: "Catalog item",
    });

    const nextKind = input.kind ?? (existing.kind as ProductKind);
    const packageItems =
      input.packageItems === undefined
        ? undefined
        : sanitizePackageItems(input.packageItems);
    const packageSummary =
      input.package === undefined ? undefined : (input.package ?? null);
    assertPackageItems(
      nextKind,
      packageItems ?? existing.package?.items ?? null,
    );
    assertBookableConfig(input.bookable);
    assertPriceConfig(input.price);

    const nextOrganisationId =
      input.organisationId == null
        ? existing.organisationId
        : requireSafeString(input.organisationId, "organisationId");
    const nextSpecialityId =
      input.specialityId === undefined
        ? existing.specialityId
        : optionalSafeString(input.specialityId);
    await ensureSpecialityExists(nextOrganisationId, nextSpecialityId);
    if (nextKind === "PACKAGE" && packageItems) {
      await ensurePackageItemsValid({
        organisationId: nextOrganisationId,
        packageItems,
        currentProductId: productId,
      });
    }

    const shouldAutoUpdateCode =
      input.code === undefined &&
      input.kind !== undefined &&
      input.kind !== existing.kind;
    const nextCode =
      input.code === undefined
        ? shouldAutoUpdateCode
          ? null
          : existing.code
        : optionalSafeString(input.code);
    const resolvedCode =
      nextCode ?? (await generateProductCode(nextOrganisationId, nextKind));
    await ensureCodeUniqueness({
      organisationId: nextOrganisationId,
      code: resolvedCode,
      excludeProductId: productId,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const updateData = {
        organisationId:
          input.organisationId == null ? undefined : nextOrganisationId,
        name:
          input.name == null
            ? undefined
            : requireSafeString(input.name, "name"),
        description:
          input.description === undefined
            ? undefined
            : (optionalSafeString(input.description) ?? null),
        code: resolvedCode,
        kind: input.kind,
        specialityId:
          input.specialityId === undefined ? undefined : nextSpecialityId,
        legacyServiceId:
          input.legacyServiceId === undefined
            ? undefined
            : optionalSafeString(input.legacyServiceId),
        isActive: input.isActive,
        version: {
          increment: 1,
        },
      } satisfies Prisma.ProductItemUpdateInput;

      await tx.productItem.update({
        where: { id: productId },
        data: updateData,
      });

      if (input.price !== undefined) {
        const defaultPrice = await tx.productPrice.findFirst({
          where: { productItemId: productId, isDefault: true },
        });
        if (input.price === null) {
          if (defaultPrice) {
            await tx.productPrice.delete({ where: { id: defaultPrice.id } });
          }
        } else if (defaultPrice) {
          await tx.productPrice.update({
            where: { id: defaultPrice.id },
            data: {
              unitPrice: input.price.unitPrice,
              currency: input.price.currency ?? null,
              defaultDiscountPercent:
                input.price.defaultDiscountPercent ?? null,
              maxDiscountPercent: input.price.maxDiscountPercent ?? null,
            },
          });
        } else {
          await tx.productPrice.create({
            data: {
              productItemId: productId,
              unitPrice: input.price.unitPrice,
              currency: input.price.currency ?? undefined,
              defaultDiscountPercent:
                input.price.defaultDiscountPercent ?? undefined,
              maxDiscountPercent: input.price.maxDiscountPercent ?? undefined,
              isDefault: true,
            },
          });
        }
      }

      if (input.bookable !== undefined) {
        if (input.bookable === null) {
          await tx.productBookable.deleteMany({
            where: { productItemId: productId },
          });
        } else {
          await tx.productBookable.upsert({
            where: { productItemId: productId },
            update: {
              durationMinutes: input.bookable.durationMinutes,
              supportsOutpatient: input.bookable.supportsOutpatient ?? true,
              supportsInpatient: input.bookable.supportsInpatient ?? false,
            },
            create: {
              productItemId: productId,
              durationMinutes: input.bookable.durationMinutes,
              supportsOutpatient: input.bookable.supportsOutpatient ?? true,
              supportsInpatient: input.bookable.supportsInpatient ?? false,
            },
          });
        }
      }

      if (nextKind === "PACKAGE") {
        const pkg = await tx.productPackage.upsert({
          where: { productItemId: productId },
          update:
            packageSummary === undefined
              ? {}
              : ({
                  leadCount: packageSummary?.leadCount ?? 1,
                  supportCount: packageSummary?.supportCount ?? 0,
                  additionalDiscountPercent:
                    packageSummary?.additionalDiscountPercent ?? 0,
                } satisfies Prisma.ProductPackageUpdateWithoutProductItemInput),
          create: {
            productItem: {
              connect: { id: productId },
            },
            leadCount: packageSummary?.leadCount ?? 1,
            supportCount: packageSummary?.supportCount ?? 0,
            additionalDiscountPercent:
              packageSummary?.additionalDiscountPercent ?? 0,
          } satisfies Prisma.ProductPackageCreateInput,
        });

        if (packageItems !== undefined) {
          const nextPackageItems = packageItems ?? [];
          await tx.productPackageItem.deleteMany({
            where: { packageId: pkg.id },
          });

          if (nextPackageItems.length > 0) {
            await tx.productPackageItem.createMany({
              data: nextPackageItems.map((item) => ({
                packageId: pkg.id,
                childProductItemId: item.childProductItemId,
                quantity: item.quantity,
                pricingMode: item.pricingMode,
                overridePrice: item.overridePrice,
                discountPercent: item.discountPercent,
                sortOrder: item.sortOrder,
                isOptional: item.isOptional,
              })),
            });
          }
        }
      } else {
        const pkg = await tx.productPackage.findUnique({
          where: { productItemId: productId },
        });
        if (pkg) {
          await tx.productPackage.delete({ where: { id: pkg.id } });
        }
      }

      return (await tx.productItem.findUnique({
        where: { id: productId },
        include: productSelectionInclude,
      })) as unknown as ProductRecord | null;
    });

    if (!updated) {
      throw new CatalogServiceError("Product not found.", 404);
    }

    return mapProductRecordToView(updated);
  },

  async getProductById(id: string, organisationId?: string) {
    const productId = requireSafeString(id, "productId");
    const product = (await prisma.productItem.findFirst({
      where: {
        id: productId,
        ...(organisationId ? { organisationId } : {}),
      },
      include: productSelectionInclude,
    })) as unknown as ProductRecord | null;

    if (!product) {
      throw new CatalogServiceError("Product not found.", 404);
    }

    return mapProductRecordToView(product);
  },

  async getPackageDetail(id: string, organisationId?: string) {
    const productId = requireSafeString(id, "productId");
    const product = (await prisma.productItem.findFirst({
      where: {
        id: productId,
        kind: "PACKAGE",
        ...(organisationId ? { organisationId } : {}),
      },
      include: productSelectionInclude,
    })) as unknown as ProductRecord | null;

    if (!product) {
      throw new CatalogServiceError("Package not found.", 404);
    }

    return mapPackageRecordToDetail(product);
  },

  async listProducts(filters: CatalogProductListFilters) {
    const organisationId = requireSafeString(
      filters.organisationId,
      "organisationId",
    );

    const products = (await prisma.productItem.findMany({
      where: {
        organisationId,
        ...(filters.specialityId
          ? {
              specialityId: requireSafeString(
                filters.specialityId,
                "specialityId",
              ),
            }
          : {}),
        ...(filters.kinds && filters.kinds.length > 0
          ? { kind: { in: filters.kinds } }
          : {}),
        ...(typeof filters.active === "boolean"
          ? { isActive: filters.active }
          : filters.includeInactive
            ? {}
            : { isActive: true }),
        ...(filters.search
          ? {
              OR: [
                {
                  name: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  code: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
        ...(typeof filters.supportsInpatient === "boolean"
          ? {
              bookable: {
                is: {
                  supportsInpatient: filters.supportsInpatient,
                },
              },
            }
          : {}),
      },
      include: productSelectionInclude,
      orderBy: [{ name: "asc" }],
    })) as unknown as ProductRecord[];

    return products.map(mapProductRecordToView);
  },

  async getSpecialityCatalog(
    filters: SpecialityCatalogFilters,
  ): Promise<SpecialityCatalogView> {
    const organisationId = requireSafeString(
      filters.organisationId,
      "organisationId",
    );
    const specialityId = requireSafeString(
      filters.specialityId,
      "specialityId",
    );
    const search = optionalSafeString(filters.search);
    const activeTab = filters.tab ?? "all";

    const products = (await prisma.productItem.findMany({
      where: {
        organisationId,
        specialityId,
        ...(filters.includeInactive ? {} : { isActive: true }),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: productSelectionInclude,
      orderBy: [{ name: "asc" }],
    })) as unknown as ProductRecord[];

    const services = products
      .filter((product) => product.kind !== "PACKAGE")
      .map(mapProductRecordToCatalogListRow);
    const packages = products
      .filter((product) => product.kind === "PACKAGE")
      .map(mapProductRecordToCatalogListRow);

    return {
      specialityId,
      organisationId,
      activeTab,
      search,
      services: activeTab === "packages" ? [] : services,
      packages: activeTab === "services" ? [] : packages,
    };
  },

  async resolveSelection(productItemId: string, organisationId?: string) {
    const product = (await prisma.productItem.findFirst({
      where: {
        OR: [{ id: productItemId }, { legacyServiceId: productItemId }],
        ...(organisationId ? { organisationId } : {}),
      },
      include: productSelectionInclude,
    })) as unknown as ProductRecord | null;

    if (!product) {
      throw new CatalogServiceError("Product not found.", 404);
    }

    const templateKinds = resolveSelectionTemplateKinds({
      productKind: product.kind,
      appointmentKinds: toAppointmentKinds(product.bookable),
    });
    const templateBindings = await loadTemplateBindingsForProduct({
      productItemId: product.id,
      templateKinds,
    });

    return resolveCatalogSelectionFromRecord(product, templateBindings);
  },

  async getBookableSlotsService(
    productItemId: string,
    organisationId: string,
    referenceDate: Date,
  ) {
    const context = await resolveCatalogSchedulingContext(
      productItemId,
      organisationId,
    );

    return buildBookableWindowsForVets({
      organisationId: context.organisationId,
      vetIds: context.vetIds,
      durationMinutes: context.durationMinutes,
      referenceDate,
      getBookableSlotsForDate: (...args) =>
        AvailabilityService.getBookableSlotsForDate(...args),
    });
  },

  async getCalendarPrefillMatches(input: CatalogCalendarPrefillRequest) {
    const serviceIds = Array.from(
      new Set(
        input.serviceIds
          .map((serviceId) => requireSafeString(serviceId, "serviceId"))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));

    if (serviceIds.length === 0) {
      return [];
    }

    const safeOrganisationId = requireSafeString(
      input.organisationId,
      "organisationId",
    );
    const safeLeadId = input.leadId
      ? requireSafeString(input.leadId, "leadId")
      : undefined;

    const cacheKey = JSON.stringify({
      organisationId: safeOrganisationId,
      date: dayjs(input.date).utc().format("YYYY-MM-DD"),
      minuteOfDay: input.minuteOfDay,
      leadId: safeLeadId ?? "",
      serviceIds,
    });

    return addCachedPromise(
      calendarPrefillCache,
      cacheKey,
      CALENDAR_PREFILL_CACHE_TTL_MS,
      async () => {
        const timezone = await resolveOrganisationTimezone({
          organisationId: safeOrganisationId,
          leadId: safeLeadId,
          getLeadPersonalDetails: async (organisationId, leadId) =>
            (
              await prisma.userProfile.findFirst({
                where: {
                  organizationId: organisationId,
                  userId: leadId,
                },
                select: {
                  personalDetails: true,
                },
              })
            )?.personalDetails,
          getOrganisationPersonalDetails: async (organisationId) =>
            (
              await prisma.userProfile.findFirst({
                where: {
                  organizationId: organisationId,
                },
                select: {
                  personalDetails: true,
                },
              })
            )?.personalDetails,
        });

        const slotCache = new Map<
          string,
          Promise<{
            date: string;
            dayOfWeek: string;
            windows: AvailabilitySlotMongo[];
          }>
        >();

        const serviceContexts = await Promise.all(
          serviceIds.map((serviceId) =>
            resolveCatalogSchedulingContext(serviceId, input.organisationId),
          ),
        );

        const utcDateShifts = [-1, 0, 1] as const;
        const matches: CatalogCalendarPrefillMatch[] = [];

        for (const context of serviceContexts) {
          for (const utcDateShift of utcDateShifts) {
            const referenceDate = dayjs(input.date)
              .utc()
              .add(utcDateShift, "day")
              .toDate();

            const result = await buildBookableWindowsForVets({
              organisationId: context.organisationId,
              vetIds: context.vetIds,
              durationMinutes: context.durationMinutes,
              referenceDate,
              slotCache,
              getBookableSlotsForDate: (...args) =>
                AvailabilityService.getBookableSlotsForDate(...args),
            });

            for (const slot of result.windows) {
              if (
                input.leadId &&
                !(slot.vetIds ?? []).includes(
                  requireSafeString(input.leadId, "leadId"),
                )
              ) {
                continue;
              }

              const meta = normalizeSlotForSelectedDay({
                timezone,
                utcDateShift,
                slot,
              });
              if (!meta) {
                continue;
              }

              if (
                Math.abs(meta.localStartMinute - input.minuteOfDay) >
                SLOT_MATCH_TOLERANCE_MINUTES
              ) {
                continue;
              }

              matches.push({
                serviceId: context.productItemId,
                slot: {
                  startTime: slot.startTime,
                  endTime: slot.endTime,
                  vetIds: slot.vetIds ?? [],
                },
                meta,
              });
            }
          }
        }

        matches.sort((a, b) => {
          if (a.meta.localStartMinute !== b.meta.localStartMinute) {
            return a.meta.localStartMinute - b.meta.localStartMinute;
          }
          if (a.meta.localEndMinute !== b.meta.localEndMinute) {
            return a.meta.localEndMinute - b.meta.localEndMinute;
          }
          return a.serviceId.localeCompare(b.serviceId);
        });

        return matches;
      },
      {
        maxEntries: CALENDAR_PREFILL_CACHE_MAX_ENTRIES,
        pruneIntervalMs: CALENDAR_PREFILL_CACHE_PRUNE_INTERVAL_MS,
      },
    );
  },

  async listOrganisationsProvidingServiceNearby(
    lat?: number,
    lng?: number,
    radius = 5000,
  ) {
    const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
    let candidateOrgs: Array<
      Awaited<ReturnType<typeof prisma.organization.findMany>>[number]
    > = [];

    if (hasCoordinates) {
      const safeLat = lat as number;
      const safeLng = lng as number;
      const { latDelta, lngDelta } = getBoundingDeltas(safeLat, radius);

      const organisations = await prisma.organization.findMany({
        where: {
          isVerified: true,
          isActive: true,
          address: {
            is: {
              latitude: { gte: safeLat - latDelta, lte: safeLat + latDelta },
              longitude: { gte: safeLng - lngDelta, lte: safeLng + lngDelta },
            },
          },
        },
        include: { address: true },
      });

      const nearbyOrgs = filterWithinRadius(
        organisations,
        safeLat,
        safeLng,
        radius,
      );

      candidateOrgs =
        nearbyOrgs.length > 0
          ? nearbyOrgs
          : await prisma.organization.findMany({
              include: { address: true },
            });
    } else {
      logger.warn(
        "No coordinates provided for catalog nearby search, returning all organisations",
      );
      candidateOrgs = await prisma.organization.findMany({
        include: { address: true },
      });
    }

    if (!candidateOrgs.length) {
      return [];
    }

    const orgIds = candidateOrgs.map((org) => org.id);

    const allSpecialities = await prisma.speciality.findMany({
      where: { organisationId: { in: orgIds } },
      select: { id: true, name: true, organisationId: true },
    });

    const allProductsForOrgs = await prisma.productItem.findMany({
      where: {
        organisationId: { in: orgIds },
        isActive: true,
        bookable: {
          isNot: null,
        },
      },
      select: {
        id: true,
        name: true,
        kind: true,
        specialityId: true,
        organisationId: true,
        bookable: {
          select: {
            durationMinutes: true,
            supportsOutpatient: true,
            supportsInpatient: true,
          },
        },
        prices: {
          orderBy: [{ isDefault: "desc" as const }],
          select: {
            unitPrice: true,
          },
          take: 1,
        },
        package: {
          select: {
            items: {
              orderBy: [{ sortOrder: "asc" as const }],
              select: {
                id: true,
                childProductItemId: true,
                quantity: true,
                pricingMode: true,
                overridePrice: true,
                discountPercent: true,
                sortOrder: true,
                isOptional: true,
                childProductItem: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    kind: true,
                    isActive: true,
                    prices: {
                      orderBy: [{ isDefault: "desc" as const }],
                      select: {
                        unitPrice: true,
                        currency: true,
                        defaultDiscountPercent: true,
                        maxDiscountPercent: true,
                        isDefault: true,
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return candidateOrgs
      .map((org) => {
        const orgSpecialities = allSpecialities.filter(
          (s) => s.organisationId === org.id,
        );

        const orgServices = allProductsForOrgs
          .filter((s) => s.organisationId === org.id)
          .filter((product) => Boolean(product.bookable))
          .map((product) => {
            const packageItems =
              product.kind === "PACKAGE" && product.package?.items.length
                ? product.package.items
                    .map(buildPackageBreakdownRow)
                    .map((item) => ({
                      id: item.id,
                      childProductItemId: item.childItemId,
                      childProductName: item.childItemName,
                      childProductKind: item.childItemKind,
                      childProductCode: item.childItemCode ?? null,
                      quantity: item.quantity,
                      pricingMode: item.pricingMode,
                      overridePrice: item.overridePrice,
                      discountPercent: item.discountPercent,
                      sortOrder: item.sortOrder,
                      isOptional: item.isOptional,
                      currency: item.currency,
                      grossAmount: item.grossAmount,
                      discountAmount: item.discountAmount,
                      finalAmount: item.finalAmount,
                    }))
                : undefined;

            return {
              id: product.id,
              name: product.name,
              kind: product.kind,
              appointmentKinds: toAppointmentKinds(product.bookable),
              cost: product.prices?.[0]?.unitPrice ?? 0,
              specialityId: product.specialityId,
              organisationId: product.organisationId,
              ...(packageItems ? { packageItems } : {}),
            };
          });

        const specialitiesWithServices = orgSpecialities
          .map((spec) => {
            const specServices = orgServices.filter(
              (srv) => srv.specialityId === spec.id,
            );

            return {
              ...spec,
              services: specServices,
            };
          })
          .filter((spec) => spec.services.length > 0);

        return {
          ...mapOrganisationWithAddress(org),
          specialities: specialitiesWithServices,
        };
      })
      .filter((org) => org.specialities.length > 0);
  },

  async getOrganisationSummary(
    organisationIdInput: string,
    options?: { search?: string; includeArchived?: boolean },
  ): Promise<CatalogSummaryView> {
    const organisationId = requireSafeString(
      organisationIdInput,
      "organisationId",
    );

    const [specialities, products] = await Promise.all([
      prisma.speciality.findMany({
        where: {
          organisationId,
          ...(options?.includeArchived ? {} : { isActive: true }),
        },
        select: {
          id: true,
          organisationId: true,
          name: true,
          headUserId: true,
          headName: true,
          headProfilePicUrl: true,
          memberUserIds: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.productItem.findMany({
        where: {
          organisationId,
          ...(options?.includeArchived ? {} : { isActive: true }),
        },
        select: {
          specialityId: true,
          isActive: true,
          kind: true,
          name: true,
          code: true,
          description: true,
        },
      }),
    ]);

    return {
      organisationId,
      items: mapSpecialitySummaries({
        specialities,
        products,
        search: options?.search ?? null,
      }),
    };
  },

  async listSpecialities(
    organisationIdInput: string,
    options?: {
      search?: string;
      page?: number;
      pageSize?: number;
      status?: "ACTIVE" | "ARCHIVED";
    },
  ): Promise<SpecialityCatalogListView> {
    const organisationId = requireSafeString(
      organisationIdInput,
      "organisationId",
    );
    const page = options?.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0 ? options.pageSize : 50;

    const summary = await this.getOrganisationSummary(organisationId, {
      search: options?.search,
      includeArchived: options?.status === "ARCHIVED",
    });

    const start = (page - 1) * pageSize;
    const items =
      options?.status && options.status !== "ACTIVE"
        ? summary.items
            .filter((item) => item.status === options.status)
            .slice(start, start + pageSize)
        : summary.items.slice(start, start + pageSize);

    return {
      organisationId,
      page,
      pageSize,
      total:
        options?.status && options.status !== "ACTIVE"
          ? summary.items.filter((item) => item.status === options.status)
              .length
          : summary.items.length,
      items,
    };
  },

  async getSpecialityById(
    specialityIdInput: string,
    organisationIdInput?: string,
  ) {
    const specialityId = requireSafeString(specialityIdInput, "specialityId");
    const speciality = await prisma.speciality.findFirst({
      where: {
        id: specialityId,
        ...(organisationIdInput
          ? {
              organisationId: requireSafeString(
                organisationIdInput,
                "organisationId",
              ),
            }
          : {}),
      },
      select: {
        id: true,
        organisationId: true,
        name: true,
        headUserId: true,
        headName: true,
        headProfilePicUrl: true,
        memberUserIds: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!speciality) {
      throw new CatalogServiceError("Speciality not found.", 404, "NOT_FOUND");
    }

    const summary = await this.getOrganisationSummary(
      speciality.organisationId,
      {
        includeArchived: true,
      },
    );
    const match = summary.items.find((item) => item.id === specialityId);

    if (!match) {
      throw new CatalogServiceError("Speciality not found.", 404, "NOT_FOUND");
    }

    return match;
  },

  async getArchiveCatalog(
    organisationIdInput: string,
    specialityIdInput: string,
    search?: string,
  ): Promise<ArchiveCatalogView> {
    const organisationId = requireSafeString(
      organisationIdInput,
      "organisationId",
    );
    const specialityId = requireSafeString(specialityIdInput, "specialityId");

    const products = (await prisma.productItem.findMany({
      where: {
        organisationId,
        specialityId,
        isActive: false,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: productSelectionInclude,
      orderBy: [{ name: "asc" }],
    })) as unknown as ProductRecord[];

    return {
      services: products
        .filter((product) => product.kind !== "PACKAGE")
        .map(mapProductRecordToCatalogListRow),
      packages: products
        .filter((product) => product.kind === "PACKAGE")
        .map(mapProductRecordToCatalogListRow),
    };
  },

  async searchItems(params: {
    organisationId: string;
    q?: string;
    specialityId?: string;
    kinds?: Array<
      | "CONSULTATION"
      | "PROCEDURE"
      | "LAB"
      | "MEDICATION"
      | "INVENTORY"
      | "PACKAGE"
    >;
    includeArchived?: boolean;
    excludePackageId?: string;
    includeNestedBreakdown?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<CatalogSearchResult> {
    const organisationId = requireSafeString(
      params.organisationId,
      "organisationId",
    );
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize =
      params.pageSize && params.pageSize > 0 ? params.pageSize : 20;
    const query = optionalSafeString(params.q);
    const specialityId = optionalSafeString(params.specialityId);
    const wantsInventory = !params.kinds || params.kinds.includes("INVENTORY");
    const productKinds =
      params.kinds && params.kinds.length > 0
        ? params.kinds.flatMap((kind) => {
            switch (kind) {
              case "LAB":
                return ["LAB_TEST", "DIAGNOSTIC"] as ProductKind[];
              case "INVENTORY":
                return ["INVENTORY_ITEM"] as ProductKind[];
              default:
                return [kind] as ProductKind[];
            }
          })
        : undefined;

    const [products, inventoryItems, packageGraph] = await Promise.all([
      prisma.productItem.findMany({
        where: {
          organisationId,
          ...(specialityId ? { specialityId } : {}),
          ...(productKinds && productKinds.length > 0
            ? { kind: { in: productKinds } }
            : {}),
          ...(params.includeArchived ? {} : { isActive: true }),
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { code: { contains: query, mode: "insensitive" } },
                  { description: { contains: query, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: productSelectionInclude,
        orderBy: [{ name: "asc" }],
      }),
      wantsInventory
        ? prisma.inventoryItem.findMany({
            where: {
              organisationId,
              ...(params.includeArchived
                ? { status: { not: "DELETED" } }
                : { status: "ACTIVE" }),
              ...(query
                ? {
                    OR: [
                      { name: { contains: query, mode: "insensitive" } },
                      { sku: { contains: query, mode: "insensitive" } },
                      { description: { contains: query, mode: "insensitive" } },
                    ],
                  }
                : {}),
            },
            orderBy: [{ name: "asc" }],
          })
        : Promise.resolve([]),
      params.excludePackageId
        ? buildPackageGraph(organisationId)
        : Promise.resolve(null),
    ]);

    const mappedProducts = (
      products as unknown as ProductRecord[]
    ).map<CatalogSearchItem>((product) => {
      const row = mapProductRecordToCatalogListRow(product);
      const blockReason =
        params.excludePackageId && product.kind === "PACKAGE"
          ? product.id === params.excludePackageId
            ? "Current package cannot include itself."
            : packageGraph &&
                packageContainsTarget(
                  packageGraph,
                  product.id,
                  params.excludePackageId,
                )
              ? "Adding this package would create a cycle."
              : null
          : null;

      return {
        id: product.id,
        organisationId: product.organisationId,
        specialityId: product.specialityId,
        code: product.code,
        name: product.name,
        description: product.description,
        kind: product.kind,
        source: "CATALOG",
        status: product.isActive ? "ACTIVE" : "ARCHIVED",
        isBookable: row.isBookable,
        durationMinutes: row.durationMinutes,
        unitPrice: row.unitPrice ?? row.totalAmount,
        currency: row.currency ?? null,
        defaultDiscountPercent: row.defaultDiscountPercent ?? 0,
        maxDiscountPercent: row.maxDiscountPercent ?? 0,
        totalAmount: row.totalAmount,
        canBeAddedToPackage: !blockReason,
        blockReason,
        nestedBreakdown:
          params.includeNestedBreakdown && product.kind === "PACKAGE"
            ? mapPackageRecordToDetail(product).items
            : null,
      };
    });

    const mappedInventory = inventoryItems.map<CatalogSearchItem>((item) => ({
      id: item.id,
      organisationId: item.organisationId,
      specialityId: null,
      code: item.sku ?? null,
      name: item.name,
      description: item.description ?? null,
      kind: "INVENTORY_ITEM",
      source: "INVENTORY",
      status: item.status === "ACTIVE" ? "ACTIVE" : "ARCHIVED",
      isBookable: false,
      durationMinutes: null,
      unitPrice: item.sellingPrice ?? 0,
      currency: item.currency ?? null,
      defaultDiscountPercent: 0,
      maxDiscountPercent: 0,
      totalAmount: item.sellingPrice ?? 0,
      canBeAddedToPackage: item.status === "ACTIVE",
      blockReason:
        item.status === "ACTIVE" ? null : "Inventory item is archived.",
      nestedBreakdown: null,
    }));

    const combined = [...mappedProducts, ...mappedInventory];
    const start = (page - 1) * pageSize;

    return {
      query,
      page,
      pageSize,
      total: combined.length,
      items: combined.slice(start, start + pageSize),
    };
  },

  async archiveProduct(
    id: string,
    organisationId?: string,
    expectedVersion?: number,
  ) {
    return this.updateProduct(id, {
      ...(organisationId ? { organisationId } : {}),
      isActive: false,
      expectedVersion,
    });
  },

  async restoreProduct(
    id: string,
    organisationId?: string,
    expectedVersion?: number,
  ) {
    const product = await this.getProductById(id, organisationId);
    assertCatalogVersion({
      currentVersion: product.version,
      expectedVersion,
      resourceName: "Catalog item",
    });
    if (product.kind === "PACKAGE") {
      await ensurePackageItemsValid({
        organisationId: product.organisationId,
        packageItems: product.packageItems.map((item) => ({
          childProductItemId: item.childProductItemId,
          quantity: item.quantity,
          pricingMode: item.pricingMode,
          overridePrice: item.overridePrice,
          discountPercent: item.discountPercent,
          sortOrder: item.sortOrder,
          isOptional: item.isOptional,
        })),
        currentProductId: id,
      });
    }

    return this.updateProduct(id, {
      ...(organisationId ? { organisationId } : {}),
      isActive: true,
      expectedVersion: expectedVersion ?? product.version,
    });
  },

  async deleteProduct(
    id: string,
    organisationId?: string,
    expectedVersion?: number,
  ) {
    const productId = requireSafeString(id, "productId");
    const existing = await prisma.productItem.findFirst({
      where: {
        id: productId,
        ...(organisationId ? { organisationId } : {}),
      },
      select: { id: true, version: true },
    });
    if (!existing) {
      throw new CatalogServiceError("Product not found.", 404, "NOT_FOUND");
    }
    assertCatalogVersion({
      currentVersion: existing.version,
      expectedVersion,
      resourceName: "Catalog item",
    });
    await ensureProductDeletionAllowed(productId, organisationId);

    await prisma.productItem.delete({
      where: { id: productId },
    });
  },

  async createSpeciality(input: CatalogSpecialityInput) {
    const organisationId = requireSafeString(
      input.organisationId,
      "organisationId",
    );
    const name = requireSafeString(input.name, "name");
    const headUserId = optionalSafeString(input.headUserId) ?? null;
    const teamMemberIds = Array.from(
      new Set([
        ...sanitizeTeamMemberIds(input.teamMemberIds),
        ...(headUserId ? [headUserId] : []),
      ]),
    );

    await ensureSpecialityNameUnique({ organisationId, name });

    return prisma.speciality.create({
      data: {
        organisationId,
        name,
        headUserId,
        headName: optionalSafeString(input.headName) ?? undefined,
        headProfilePicUrl:
          optionalSafeString(input.headProfilePicUrl) ?? undefined,
        memberUserIds: teamMemberIds,
        isActive: input.isActive ?? true,
      },
    });
  },

  async updateSpeciality(
    specialityIdInput: string,
    input: Partial<CatalogSpecialityInput>,
  ) {
    const specialityId = requireSafeString(specialityIdInput, "specialityId");
    const existing = await prisma.speciality.findFirst({
      where: { id: specialityId },
    });

    if (!existing) {
      throw new CatalogServiceError("Speciality not found.", 404, "NOT_FOUND");
    }

    const organisationId = input.organisationId
      ? requireSafeString(input.organisationId, "organisationId")
      : existing.organisationId;
    const name = input.name
      ? requireSafeString(input.name, "name")
      : existing.name;
    const headUserId =
      input.headUserId === undefined
        ? existing.headUserId
        : (optionalSafeString(input.headUserId) ?? null);
    const teamMemberIds =
      input.teamMemberIds === undefined
        ? Array.from(
            new Set([
              ...(existing.memberUserIds ?? []),
              ...(headUserId ? [headUserId] : []),
            ]),
          )
        : Array.from(
            new Set([
              ...sanitizeTeamMemberIds(input.teamMemberIds),
              ...(headUserId ? [headUserId] : []),
            ]),
          );

    await ensureSpecialityNameUnique({
      organisationId,
      name,
      excludeId: specialityId,
    });

    return prisma.speciality.update({
      where: { id: specialityId },
      data: {
        organisationId,
        name,
        headUserId,
        headName:
          input.headName === undefined
            ? existing.headName
            : optionalSafeString(input.headName),
        headProfilePicUrl:
          input.headProfilePicUrl === undefined
            ? existing.headProfilePicUrl
            : optionalSafeString(input.headProfilePicUrl),
        memberUserIds: teamMemberIds,
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
    });
  },

  async archiveSpeciality(
    specialityIdInput: string,
    organisationIdInput: string,
  ) {
    const specialityId = requireSafeString(specialityIdInput, "specialityId");
    const organisationId = requireSafeString(
      organisationIdInput,
      "organisationId",
    );

    const speciality = await prisma.speciality.findFirst({
      where: { id: specialityId, organisationId },
    });
    if (!speciality) {
      throw new CatalogServiceError("Speciality not found.", 404, "NOT_FOUND");
    }

    await prisma.productItem.updateMany({
      where: { organisationId, specialityId },
      data: { isActive: false },
    });

    return prisma.speciality.update({
      where: { id: specialityId },
      data: { isActive: false },
    });
  },

  async restoreSpeciality(
    specialityIdInput: string,
    organisationIdInput: string,
  ) {
    const specialityId = requireSafeString(specialityIdInput, "specialityId");
    const organisationId = requireSafeString(
      organisationIdInput,
      "organisationId",
    );

    const speciality = await prisma.speciality.findFirst({
      where: { id: specialityId, organisationId },
    });
    if (!speciality) {
      throw new CatalogServiceError("Speciality not found.", 404, "NOT_FOUND");
    }

    return prisma.speciality.update({
      where: { id: specialityId },
      data: { isActive: true },
    });
  },

  async deleteSpeciality(
    specialityIdInput: string,
    organisationIdInput: string,
  ) {
    const specialityId = requireSafeString(specialityIdInput, "specialityId");
    const organisationId = requireSafeString(
      organisationIdInput,
      "organisationId",
    );

    const speciality = await prisma.speciality.findFirst({
      where: { id: specialityId, organisationId },
    });
    if (!speciality) {
      throw new CatalogServiceError("Speciality not found.", 404, "NOT_FOUND");
    }

    await ensureSpecialityDeletionAllowed(specialityId, organisationId);
    await prisma.speciality.delete({ where: { id: specialityId } });
  },
};
