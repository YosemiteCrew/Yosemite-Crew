import { BusinessType } from "@/app/types/org";
import {
  InventoryApiItem,
  InventoryBatchPayload,
  InventoryFiltersState,
  InventoryItem,
  InventoryRequestPayload,
  StockHealthStatus,
} from "./types";

const toStringSafe = (value: any): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "number" && Number.isNaN(value)) return "";
  return String(value);
};

const toNumberSafe = (value: any): number | undefined => {
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
  const batchData = apiItem.batches?.[0];
  const statusLabel = formatStatusLabel(apiItem.status);
  const stockHealthLabel = formatStockHealthLabel(apiItem.stockHealth);
  const num = (val: any): number | undefined => {
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const onHandVal =
    num(apiItem.onHand) ??
    num(attributes.onHand) ??
    num(attributes.current) ??
    num(attributes.available);
  const effectiveOnHand =
    onHandVal && onHandVal !== 0
      ? onHandVal
      : num(attributes.available) ?? onHandVal;
  const allocatedVal = num(apiItem.allocated) ?? num(attributes.allocated);
  const available =
    num(attributes.available) ??
    (effectiveOnHand !== undefined && allocatedVal !== undefined
      ? effectiveOnHand - allocatedVal
      : effectiveOnHand);

  const normalizeStringOrArray = (val: any): string | string[] => {
    if (Array.isArray(val)) return val.filter(Boolean);
    if (val === undefined || val === null) return "";
    return String(val);
  };

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
      current: toStringSafe(effectiveOnHand ?? attributes.current),
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
        batchData?.batchNumber ??
          batchData?.lotNumber ??
          attributes.batch ??
          attributes.batchNumber ??
          attributes.lotNumber ??
          attributes.serial ??
          apiItem.sku
      ),
      manufactureDate: toStringSafe(
        batchData?.manufactureDate ?? attributes.manufactureDate
      ),
      expiryDate: toStringSafe(batchData?.expiryDate ?? attributes.expiryDate),
      serial: toStringSafe(batchData?.lotNumber ?? attributes.serial),
      tracking: toStringSafe(
        batchData?.regulatoryTrackingId ?? attributes.tracking
      ),
      litterId: toStringSafe(attributes.litterId),
      nextRefillDate: toStringSafe(
        batchData?.minShelfLifeAlertDate ??
          attributes.minShelfLifeAlertDate ??
          attributes.nextRefillDate
      ),
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

const buildBatchPayload = (
  formData: InventoryItem
): InventoryBatchPayload | undefined => {
  const { batch } = formData;
  const quantity = toNumberSafe(formData.stock.current);
  const allocated = toNumberSafe(formData.stock.allocated);

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

  const payload: InventoryBatchPayload = cleanObject({
    batchNumber: batch.batch,
    lotNumber: batch.serial,
    regulatoryTrackingId: batch.tracking,
    manufactureDate: normalizeDateForApi(batch.manufactureDate),
    expiryDate: normalizeDateForApi(batch.expiryDate),
    minShelfLifeAlertDate: normalizeDateForApi(batch.nextRefillDate),
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
    available: formData.stock.available,
    serial: formData.batch.serial,
    tracking: formData.batch.tracking,
    litterId: formData.batch.litterId,
    nextRefillDate: formData.batch.nextRefillDate,
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
    onHand: toNumberSafe(formData.stock.current),
    allocated: toNumberSafe(formData.stock.allocated),
    reorderLevel: toNumberSafe(formData.stock.reorderLevel),
    unitCost: toNumberSafe(formData.pricing.purchaseCost),
    sellingPrice: toNumberSafe(formData.pricing.selling),
    currency: "USD",
    vendorId: formData.vendor.vendor,
    status: statusForApi,
  };

  const batchPayload = buildBatchPayload(formData);
  if (batchPayload) {
    payload.batches = [batchPayload];
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
