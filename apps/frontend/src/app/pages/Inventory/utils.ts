import { BusinessType } from "@/app/types/org";
import {
  InventoryApiItem,
  InventoryBatchPayload,
  InventoryFiltersState,
  InventoryItem,
  InventoryRequestPayload,
  StockHealthStatus,
  BatchValues,
} from "./types";

export const toStringSafe = (value: any): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "number" && Number.isNaN(value)) return "";
  return String(value);
};

export const toNumberSafe = (value: any): number | undefined => {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const cleanObject = (obj: Record<string, any>) =>
  Object.entries(obj).reduce<Record<string, any>>((acc, [key, value]) => {
    if (value === undefined || value === null || value === "") return acc;
    if (Array.isArray(value) && value.length === 0) return acc;
    acc[key] = value;
    return acc;
  }, {});

const parseDateSafe = (value?: string): Date | null => {
  if (!value) return null;
  if (value.includes("/")) {
    const [dd, mm, yyyy] = value.split("/");
    const parsed = new Date(`${yyyy}-${mm}-${dd}`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDisplayDate = (value?: string): string => {
  if (!value) return "";
  const normalize = (val: string) => {
    if (val.includes("/")) {
      const [dd, mm, yyyy] = val.split("/");
      const parsed = new Date(`${yyyy}-${mm}-${dd}`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const parsed = new Date(val);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const date = normalize(value);
  if (!date) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const calculateBatchTotals = (
  batches?: BatchValues[]
): { onHand?: number; allocated?: number; available?: number } => {
  if (!batches || batches.length === 0) return {};

  let onHand = 0;
  let allocated = 0;
  let hasOnHand = false;
  let hasAllocated = false;

  batches.forEach((batch) => {
    const qty = toNumberSafe(batch.quantity);
    const alloc = toNumberSafe(batch.allocated);
    if (qty !== undefined) {
      onHand += qty;
      hasOnHand = true;
    }
    if (alloc !== undefined) {
      allocated += alloc;
      hasAllocated = true;
    }
  });

  const available =
    hasOnHand || hasAllocated
      ? (hasOnHand ? onHand : 0) - (hasAllocated ? allocated : 0)
      : undefined;

  return {
    onHand: hasOnHand ? onHand : undefined,
    allocated: hasAllocated ? allocated : undefined,
    available,
  };
};

export const formatStatusLabel = (status?: string): string => {
  const key = (status || "").toString().trim().toUpperCase();
  switch (key) {
    case "ACTIVE":
      return "Active";
    case "HIDDEN":
      return "Hidden";
    default:
      return status || "Active";
  }
};

export const formatStockHealthLabel = (
  stockHealth?: StockHealthStatus
): string => {
  const key = (stockHealth || "").toString().trim().toUpperCase();
  switch (key) {
    case "LOW_STOCK":
      return "Low stock";
    case "HEALTHY":
      return "Healthy";
    case "EXPIRED":
      return "Expired";
    case "EXPIRING_SOON":
      return "Expiring soon";
    default:
      return "";
  }
};

export const getStatusBadgeStyle = (statusLabel?: string) => {
  const key = (statusLabel || "").toLowerCase();
  switch (key) {
    case "low stock":
      return { color: "#F68523", backgroundColor: "#FEF3E9" };
    case "expired":
      return { color: "#EA3729", backgroundColor: "#FDEBEA" };
    case "hidden":
      return { color: "#302f2e", backgroundColor: "#eaeaea" };
    case "out of stock":
      return { color: "#EA3729", backgroundColor: "#FDEBEA" };
    case "expiring soon":
      return { color: "#C47F00", backgroundColor: "#FEF7E5" };
    case "healthy":
      return { color: "#247AED", backgroundColor: "#EAF3FF" };
    case "active":
      return { color: "#54B492", backgroundColor: "#E6F4EF" };
    case "hidden":
      return { color: "#302f2e", backgroundColor: "#eaeaea" };
    case "expired":
      return { color: "#EA3729", backgroundColor: "#FDEBEA" };
    default:
      return { color: "#247AED", backgroundColor: "#EAF3FF" };
  }
};

export const mapApiItemToInventoryItem = (
  apiItem: InventoryApiItem
): InventoryItem => {
  const attributes = apiItem.attributes ?? {};
  const statusLabel = formatStatusLabel(apiItem.status);
  const stockHealthLabel = formatStockHealthLabel(apiItem.stockHealth);
  const normalizeStringOrArray = (val: any): string | string[] => {
    if (Array.isArray(val)) return val.filter(Boolean);
    if (val === undefined || val === null) return "";
    return String(val);
  };

  const firstDefined = <T,>(...vals: (T | undefined)[]): T | undefined => {
    for (const val of vals) {
      if (val !== undefined) return val;
    }
    return undefined;
  };

  const batches =
    apiItem.batches?.map((b) => ({
      _id: b._id,
      itemId: b.itemId,
      organisationId: b.organisationId,
      batch: toStringSafe(
        b.batchNumber ??
          b.lotNumber ??
          attributes.batch ??
          attributes.batchNumber ??
          attributes.lotNumber ??
          attributes.serial ??
          apiItem.sku
      ),
      manufactureDate: toStringSafe(
        b.manufactureDate ?? attributes.manufactureDate
      ),
      expiryDate: toStringSafe(b.expiryDate ?? attributes.expiryDate),
      serial: toStringSafe(b.lotNumber ?? attributes.serial),
      tracking: toStringSafe(b.regulatoryTrackingId ?? attributes.tracking),
      litterId: toStringSafe(attributes.litterId),
      nextRefillDate: toStringSafe(
        b.minShelfLifeAlertDate ??
          attributes.minShelfLifeAlertDate ??
          attributes.nextRefillDate
      ),
      minShelfLifeAlertDate: toStringSafe(
        b.minShelfLifeAlertDate ?? attributes.minShelfLifeAlertDate
      ),
      quantity: toStringSafe(b.quantity),
      allocated: toStringSafe(b.allocated),
      createdAt: toStringSafe(b.createdAt),
      updatedAt: toStringSafe(b.updatedAt),
    })) ?? [];

  const selectPrimaryBatch = (batchList: BatchValues[]): BatchValues | undefined => {
    if (!batchList.length) return undefined;
    const withExpiry = batchList
      .map((b) => ({ batch: b, date: parseDateSafe(b.expiryDate) }))
      .filter((entry) => entry.date !== null) as { batch: BatchValues; date: Date }[];
    if (withExpiry.length) {
      return withExpiry.reduce((earliest, current) =>
        current.date.getTime() < earliest.date.getTime() ? current : earliest
      ).batch;
    }
    return batchList[0];
  };

  const batchTotals = calculateBatchTotals(batches);
  const onHandVal = firstDefined(
    batchTotals.onHand,
    toNumberSafe(apiItem.onHand),
    toNumberSafe(attributes.onHand),
    toNumberSafe(attributes.current),
    toNumberSafe(attributes.available)
  );
  const allocatedVal = firstDefined(
    batchTotals.allocated,
    toNumberSafe(apiItem.allocated),
    toNumberSafe(attributes.allocated)
  );
  const available = firstDefined(
    batchTotals.available,
    toNumberSafe(attributes.available),
    onHandVal !== undefined && allocatedVal !== undefined
      ? onHandVal - allocatedVal
      : onHandVal
  );

  const primaryBatch = selectPrimaryBatch(batches);

  return {
    id: apiItem._id,
    organisationId: apiItem.organisationId,
    businessType: apiItem.businessType,
    stockHealth: apiItem.stockHealth,
    status: apiItem.status,
    attributes,
    sku: apiItem.sku,
    imageUrl: apiItem.imageUrl,
    createdAt: apiItem.createdAt,
    updatedAt: apiItem.updatedAt,
    batches,
    basicInfo: {
      name: apiItem.name ?? "",
      category: apiItem.category ?? "",
      subCategory: apiItem.subCategory ?? "",
      department: toStringSafe(attributes.department),
      description: apiItem.description ?? "",
      status: statusLabel || stockHealthLabel || "Active",
      itemType: toStringSafe(attributes.itemType),
      prescriptionRequired: toStringSafe(attributes.prescriptionRequired),
      regulationType: toStringSafe(attributes.regulationType),
      storageCondition: toStringSafe(attributes.storageCondition),
      productUsage: toStringSafe(attributes.productUsage),
      intendedUsage: toStringSafe(attributes.intendedUsage),
      coatType: toStringSafe(attributes.coatType),
      fragranceType: toStringSafe(attributes.fragranceType),
      allergenFree: toStringSafe(attributes.allergenFree),
      petSize: toStringSafe(attributes.petSize),
      animalStage: toStringSafe(attributes.animalStage),
      skuCode: toStringSafe(attributes.skuCode ?? apiItem.sku),
    },
    classification: {
      form: toStringSafe(attributes.form),
      unitofMeasure: normalizeStringOrArray(
        attributes.unitofMeasure ?? attributes.unitOfMeasure
      ),
      species: normalizeStringOrArray(attributes.species),
      administration: toStringSafe(attributes.administration),
      therapeuticClass: toStringSafe(attributes.therapeuticClass),
      strength: toStringSafe(attributes.strength),
      dosageForm: toStringSafe(attributes.dosageForm),
      withdrawlPeriod: toStringSafe(attributes.withdrawlPeriod),
      dispenseUnit: toStringSafe(attributes.dispenseUnit),
      packSize: toStringSafe(attributes.packSize),
      usagePerService: toStringSafe(attributes.usagePerService),
      breedingUse: toStringSafe(attributes.breedingUse),
      temperatureCondition: toStringSafe(attributes.temperatureCondition),
      usageType: toStringSafe(attributes.usageType),
      litterGroup: toStringSafe(attributes.litterGroup),
      shelfLife: toStringSafe(attributes.shelfLife),
      heatCycle: toStringSafe(attributes.heatCycle),
      intakeType: toStringSafe(attributes.intakeType),
      frequency: toStringSafe(attributes.frequency),
      productUse: toStringSafe(attributes.productUse),
      safetyClassification: toStringSafe(attributes.safetyClassification),
      brand: toStringSafe(attributes.brand),
    },
    pricing: {
      purchaseCost: toStringSafe(apiItem.unitCost),
      selling: toStringSafe(apiItem.sellingPrice),
      maxDiscount: toStringSafe(attributes.maxDiscount),
      tax: toStringSafe(attributes.tax),
    },
    vendor: {
      supplierName: toStringSafe(attributes.supplierName),
      brand: toStringSafe(attributes.brand),
      vendor: toStringSafe(apiItem.vendorId ?? attributes.vendor),
      license: toStringSafe(attributes.license),
      paymentTerms: toStringSafe(attributes.paymentTerms),
      leadTime: toStringSafe(attributes.leadTime),
    },
    stock: {
      current: toStringSafe(
        onHandVal ?? toNumberSafe(attributes.current) ?? attributes.current
      ),
      allocated: toStringSafe(allocatedVal ?? attributes.allocated),
      available: toStringSafe(available),
      reorderLevel: toStringSafe(apiItem.reorderLevel),
      reorderQuantity: toStringSafe(attributes.reorderQuantity),
      stockLocation: toStringSafe(attributes.stockLocation),
      stockType: toStringSafe(attributes.stockType),
      minStockAlert: toStringSafe(attributes.minStockAlert),
    },
    batch: {
      batch: toStringSafe(
        primaryBatch?.batch ??
          attributes.batch ??
          attributes.batchNumber ??
          attributes.lotNumber ??
          attributes.serial ??
          apiItem.sku
      ),
      manufactureDate: toStringSafe(
        primaryBatch?.manufactureDate ?? attributes.manufactureDate
      ),
      expiryDate: toStringSafe(
        primaryBatch?.expiryDate ??
          attributes.expiryDate ??
          batches.find((b) => b.expiryDate)?.expiryDate
      ),
      serial: toStringSafe(primaryBatch?.serial ?? attributes.serial),
      tracking: toStringSafe(primaryBatch?.tracking ?? attributes.tracking),
      litterId: toStringSafe(primaryBatch?.litterId ?? attributes.litterId),
      nextRefillDate: toStringSafe(
        primaryBatch?.nextRefillDate ??
          attributes.minShelfLifeAlertDate ??
          attributes.nextRefillDate
      ),
      minShelfLifeAlertDate: toStringSafe(
        primaryBatch?.minShelfLifeAlertDate ??
          attributes.minShelfLifeAlertDate ??
          attributes.nextRefillDate
      ),
      quantity: toStringSafe(primaryBatch?.quantity ?? onHandVal),
      allocated: toStringSafe(primaryBatch?.allocated ?? allocatedVal),
      _id: primaryBatch?._id,
      itemId: primaryBatch?.itemId,
      organisationId: primaryBatch?.organisationId,
      createdAt: primaryBatch?.createdAt,
      updatedAt: primaryBatch?.updatedAt,
    },
  };
};

const normalizeStatusForApi = (
  status?: string
) => {
  const value = (status || "").toString().trim();
  if (!value) return "ACTIVE";
  return value.replace(/\s+/g, "_").toUpperCase();
};

export const buildBatchPayload = (
  batch: BatchValues
): InventoryBatchPayload | undefined => {
  const quantity = toNumberSafe(
    batch.quantity ?? (batch as any).current ?? (batch as any).available
  );
  const allocated = toNumberSafe(batch.allocated ?? (batch as any).allocated);
  const normalizeDateForApi = (val?: string) => {
    if (!val) return undefined;
    if (val.includes("/")) {
      const [dd, mm, yyyy] = val.split("/");
      const parsed = new Date(`${yyyy}-${mm}-${dd}`);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split("T")[0];
      }
    }
    const parsed = new Date(val);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
    return undefined;
  };

  const normalizedManufacture = normalizeDateForApi(batch.manufactureDate);
  const normalizedExpiry = normalizeDateForApi(batch.expiryDate);
  const normalizedMinShelfLife = normalizeDateForApi(
    batch.nextRefillDate ?? batch.minShelfLifeAlertDate
  );
  const manufactureRaw = toStringSafe(batch.manufactureDate);
  const expiryRaw = toStringSafe(batch.expiryDate);
  const minShelfRaw = toStringSafe(
    batch.nextRefillDate ?? batch.minShelfLifeAlertDate
  );

  const payload: InventoryBatchPayload = cleanObject({
    _id: batch._id,
    itemId: batch.itemId,
    organisationId: batch.organisationId,
    batchNumber: batch.batch,
    lotNumber: batch.serial,
    regulatoryTrackingId: batch.tracking,
    manufactureDate: normalizedManufacture ?? (manufactureRaw || undefined),
    expiryDate: normalizedExpiry ?? (expiryRaw || undefined),
    minShelfLifeAlertDate: normalizedMinShelfLife ?? (minShelfRaw || undefined),
    quantity,
    allocated,
  });

  return Object.keys(payload).length ? payload : undefined;
};

export const buildInventoryPayload = (
  formData: InventoryItem,
  organisationId: string,
  businessType: BusinessType
): InventoryRequestPayload => {
  const statusForApi = normalizeStatusForApi(
    formData.status ?? formData.basicInfo.status
  );

  const batchesSource =
    formData.batches && formData.batches.length > 0
      ? formData.batches
      : [formData.batch];
  const batchPayloads = batchesSource
    .map((b) => buildBatchPayload(b))
    .filter(Boolean) as InventoryBatchPayload[];
  const batchTotals = calculateBatchTotals(batchesSource);
  const firstBatch = batchesSource[0];

  const attributes = cleanObject({
    department: formData.basicInfo.department,
    itemType: formData.basicInfo.itemType,
    prescriptionRequired: formData.basicInfo.prescriptionRequired,
    regulationType: formData.basicInfo.regulationType,
    storageCondition: formData.basicInfo.storageCondition,
    productUsage: formData.basicInfo.productUsage,
    intendedUsage: formData.basicInfo.intendedUsage,
    coatType: formData.basicInfo.coatType,
    fragranceType: formData.basicInfo.fragranceType,
    allergenFree: formData.basicInfo.allergenFree,
    petSize: formData.basicInfo.petSize,
    animalStage: formData.basicInfo.animalStage,
    skuCode: formData.basicInfo.skuCode,
    ...formData.classification,
    tax: formData.pricing.tax,
    maxDiscount: formData.pricing.maxDiscount,
    supplierName: formData.vendor.supplierName,
    brand: formData.vendor.brand,
    vendor: formData.vendor.vendor,
    license: formData.vendor.license,
    paymentTerms: formData.vendor.paymentTerms,
    leadTime: formData.vendor.leadTime,
    stockLocation: formData.stock.stockLocation,
    stockType: formData.stock.stockType,
    minStockAlert: formData.stock.minStockAlert,
    reorderQuantity: formData.stock.reorderQuantity,
    available:
      batchTotals.available !== undefined
        ? batchTotals.available
        : toNumberSafe(formData.stock.available),
    serial: firstBatch?.serial,
    tracking: firstBatch?.tracking,
    litterId: firstBatch?.litterId,
    nextRefillDate: firstBatch?.nextRefillDate,
  });

  const payload: InventoryRequestPayload = {
    organisationId,
    businessType,
    name: formData.basicInfo.name,
    sku: formData.basicInfo.skuCode || formData.sku,
    category: formData.basicInfo.category,
    subCategory: formData.basicInfo.subCategory,
    description: formData.basicInfo.description,
    imageUrl: formData.imageUrl,
    attributes: {
      ...attributes,
      species: formData.classification.species,
      unitofMeasure: formData.classification.unitofMeasure,
    },
    onHand:
      batchTotals.onHand !== undefined
        ? batchTotals.onHand
        : toNumberSafe(formData.stock.current),
    allocated:
      batchTotals.allocated !== undefined
        ? batchTotals.allocated
        : toNumberSafe(formData.stock.allocated),
    reorderLevel: toNumberSafe(formData.stock.reorderLevel),
    unitCost: toNumberSafe(formData.pricing.purchaseCost),
    sellingPrice: toNumberSafe(formData.pricing.selling),
    currency: "USD",
    vendorId: formData.vendor.vendor,
    status: statusForApi,
  };

  if (batchPayloads.length > 0) {
    payload.batches = batchPayloads;
  }

  return payload;
};

export const defaultFilters: InventoryFiltersState = {
  category: "all",
  status: "ALL",
  search: "",
};

export const displayStatusLabel = (item: InventoryItem): string => {
  const status = formatStatusLabel(item.status || item.basicInfo.status);
  if (status.toLowerCase() === "hidden") return "Hidden";
  return (
    formatStockHealthLabel(item.stockHealth) ||
    status ||
    "Active"
  );
};
