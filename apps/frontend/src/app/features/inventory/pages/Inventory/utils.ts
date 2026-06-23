import { BusinessType } from '@/app/features/organization/types/org';
import {
  InventoryApiItem,
  InventoryBatchPayload,
  InventoryFiltersState,
  InventoryItem,
  InventoryRequestPayload,
  InventoryStatus,
  StockHealthStatus,
  BatchValues,
} from '@/app/features/inventory/pages/Inventory/types';
import { formatDisplayDate as formatGlobalDisplayDate } from '@/app/lib/date';

export const toStringSafe = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' && Number.isNaN(value)) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

export const toNumberSafe = (value: unknown): number | undefined => {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const cleanObject = (obj: Record<string, unknown>) =>
  Object.entries(obj).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined || value === null || value === '') return acc;
    if (Array.isArray(value) && value.length === 0) return acc;
    acc[key] = value;
    return acc;
  }, {});

const parseDateSafe = (value?: string): Date | null => {
  if (!value) return null;
  if (value.includes('/')) {
    const [dd, mm, yyyy] = value.split('/');
    const parsed = new Date(`${yyyy}-${mm}-${dd}`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDisplayDate = (value?: string): string => {
  if (!value) return '';
  const normalizedDate = parseDateSafe(value);
  return normalizedDate ? formatGlobalDisplayDate(normalizedDate, '') : '';
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
    const qty = batch.quantity === '' ? undefined : toNumberSafe(batch.quantity);
    const alloc = batch.allocated === '' ? undefined : toNumberSafe(batch.allocated);
    if (qty !== undefined) {
      onHand += qty;
      hasOnHand = true;
    }
    if (alloc !== undefined) {
      allocated += alloc;
      hasAllocated = true;
    }
  });

  let available: number | undefined;
  if (hasOnHand || hasAllocated) {
    const onHandValue = hasOnHand ? onHand : 0;
    const allocatedValue = hasAllocated ? allocated : 0;
    available = onHandValue - allocatedValue;
  } else {
    available = undefined;
  }

  return {
    onHand: hasOnHand ? onHand : undefined,
    allocated: hasAllocated ? allocated : undefined,
    available,
  };
};

export const formatStatusLabel = (status?: string): string => {
  const key = (status || '').toString().trim().toUpperCase();
  switch (key) {
    case 'ACTIVE':
      return 'Active';
    case 'HIDDEN':
      return 'Hidden';
    default:
      return status || 'Active';
  }
};

const normalizeStatus = (status?: string): InventoryStatus | undefined => {
  if (!status) return undefined;
  const normalized = status.trim().toUpperCase();
  switch (normalized) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'HIDDEN':
      return 'HIDDEN';
    default:
      // For any unrecognized status, default to ACTIVE
      return 'ACTIVE';
  }
};

const normalizeItemTypeForForm = (value?: string): string => {
  const normalized = (value || '').trim().toUpperCase();
  if (normalized === 'NON_MEDICAL' || normalized === 'NON-DRUG' || normalized === 'NON_DRUG') {
    return 'Non-drug';
  }
  if (normalized === 'MEDICAL' || normalized === 'DRUG') {
    return 'Drug';
  }
  return value || '';
};

const normalizeItemTypeForApi = (
  value?: string
): InventoryRequestPayload['itemType'] | undefined => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'non-drug' || normalized === 'non_medical' || normalized === 'non medical') {
    return 'NON_MEDICAL';
  }
  if (normalized === 'drug' || normalized === 'medical') {
    return 'MEDICAL';
  }
  return undefined;
};

const normalizeBooleanStringForApi = (value?: string): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') {
    if (value === 'true' || value === 'Yes') return true;
    if (value === 'false' || value === 'No') return false;
  }
  return Boolean(value);
};

export const formatStockHealthLabel = (stockHealth?: StockHealthStatus): string => {
  const key = (stockHealth || '').toString().trim().toUpperCase();
  switch (key) {
    case 'LOW_STOCK':
      return 'Low stock';
    case 'HEALTHY':
      return 'Healthy';
    case 'EXPIRED':
      return 'Expired';
    case 'EXPIRING_SOON':
      return 'Expiring soon';
    case 'OUT_OF_STOCK':
      return 'Out of stock';
    case 'OVERSTOCKED':
      return 'Overstocked';
    default:
      return '';
  }
};

export const getStatusBadgeStyle = (statusLabel?: string) => {
  const key = (statusLabel || '').toLowerCase();
  switch (key) {
    case 'low stock':
      return {
        color: 'var(--color-pill-progress-text)',
        backgroundColor: 'var(--color-pill-progress-bg)',
        borderColor: 'var(--color-pill-progress-border)',
      };
    case 'overstocked':
    case 'expiring soon':
      return {
        color: 'var(--color-pill-info-text)',
        backgroundColor: 'var(--color-pill-info-bg)',
        borderColor: 'var(--color-pill-info-border)',
      };
    case 'expired':
      return {
        color: 'var(--color-pill-warning-text)',
        backgroundColor: 'var(--color-pill-warning-bg)',
        borderColor: 'var(--color-pill-warning-border)',
      };
    case 'out of stock':
    case 'hidden':
      return {
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      };
    case 'healthy':
    case 'active':
    case 'in stock':
      return {
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      };
    default:
      return {
        color: 'var(--color-badge-blue-text)',
        backgroundColor: 'var(--color-badge-blue-bg)',
      };
  }
};

export const mapApiItemToInventoryItem = (apiItem: InventoryApiItem): InventoryItem => {
  const attributes = apiItem.attributes ?? {};
  const statusLabel = formatStatusLabel(apiItem.status);
  const stockHealthLabel = formatStockHealthLabel(apiItem.stockHealth);
  const normalizeStringOrArray = (val: unknown): string | string[] => {
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    return '';
  };

  const firstDefined = <T>(...vals: (T | undefined)[]): T | undefined => {
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
      manufactureDate: toStringSafe(b.manufactureDate ?? attributes.manufactureDate),
      expiryDate: toStringSafe(b.expiryDate ?? attributes.expiryDate),
      serial: toStringSafe(b.lotNumber ?? attributes.serial),
      tracking: toStringSafe(b.regulatoryTrackingId ?? attributes.tracking),
      litterId: toStringSafe(attributes.litterId),
      nextRefillDate: toStringSafe(
        b.minShelfLifeAlertDate ?? attributes.minShelfLifeAlertDate ?? attributes.nextRefillDate
      ),
      minShelfLifeAlertDate: toStringSafe(
        b.minShelfLifeAlertDate ?? attributes.minShelfLifeAlertDate
      ),
      expiryWarningBefore: toStringSafe(attributes.expiryWarningBefore),
      barcode: toStringSafe(attributes.barcode),
      quantity: toStringSafe(b.quantity),
      allocated: toStringSafe(b.allocated),
      createdAt: toStringSafe(b.createdAt),
      updatedAt: toStringSafe(b.updatedAt),
    })) ?? [];

  const selectPrimaryBatch = (batchList: BatchValues[]): BatchValues | undefined => {
    if (!batchList.length) return undefined;
    const withExpiry = batchList
      .map((b) => ({ batch: b, date: parseDateSafe(b.expiryDate) }))
      .filter((entry): entry is { batch: BatchValues; date: Date } => entry.date !== null);
    if (withExpiry.length) {
      return withExpiry.reduce(
        (earliest, current) =>
          current.date.getTime() < earliest.date.getTime() ? current : earliest,
        withExpiry[0]
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
    onHandVal !== undefined && allocatedVal !== undefined ? onHandVal - allocatedVal : onHandVal
  );

  const primaryBatch = selectPrimaryBatch(batches);

  return {
    id: apiItem._id,
    organisationId: apiItem.organisationId,
    businessType: apiItem.businessType,
    currency: apiItem.currency,
    stockHealth: apiItem.stockHealth,
    status: normalizeStatus(apiItem.status),
    attributes,
    sku: apiItem.sku,
    imageUrl: apiItem.imageUrl,
    createdAt: apiItem.createdAt,
    updatedAt: apiItem.updatedAt,
    batches,
    basicInfo: {
      name: apiItem.name ?? '',
      category: apiItem.category ?? '',
      subCategory: apiItem.subCategory ?? '',
      department: toStringSafe(attributes.department),
      description: apiItem.description ?? '',
      status: statusLabel || stockHealthLabel || 'Active',
      brand: toStringSafe(attributes.brand),
      imageUrl: toStringSafe(apiItem.imageUrl ?? attributes.imageUrl),
      visibleInInventory: normalizeStatus(apiItem.status) !== 'HIDDEN',
      itemType: normalizeItemTypeForForm(toStringSafe(apiItem.itemType ?? attributes.itemType)),
      drugSchedule: toStringSafe(attributes.drugSchedule),
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
      genericName: toStringSafe(apiItem.genericName ?? attributes.genericName),
      form: toStringSafe(attributes.form),
      unitofMeasure: normalizeStringOrArray(
        apiItem.unitOfMeasure ?? attributes.unitofMeasure ?? attributes.unitOfMeasure
      ),
      species: normalizeStringOrArray(attributes.species),
      administration: toStringSafe(
        apiItem.routeOfAdministration ??
          attributes.routeOfAdministration ??
          attributes.administration
      ),
      itemType: normalizeItemTypeForForm(toStringSafe(apiItem.itemType ?? attributes.itemType)),
      drugSchedule: toStringSafe(attributes.drugSchedule),
      storageCondition: toStringSafe(
        apiItem.storageInstructions ?? attributes.storageInstructions ?? attributes.storageCondition
      ),
      controlledSubstance: toStringSafe(apiItem.controlledItem ?? attributes.controlledSubstance),
      prescriptionRequired: toStringSafe(
        apiItem.prescriptionRequired ?? attributes.prescriptionRequired
      ),
      reportableToGovernment: toStringSafe(attributes.reportableToGovernment),
      therapeuticClass: toStringSafe(attributes.therapeuticClass),
      strength: toStringSafe(apiItem.strength ?? attributes.strength),
      dosageForm: toStringSafe(apiItem.dosageForm ?? attributes.dosageForm),
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
      current: toStringSafe(onHandVal ?? toNumberSafe(attributes.current) ?? attributes.current),
      allocated: toStringSafe(allocatedVal ?? attributes.allocated),
      available: toStringSafe(available),
      maxStock: toStringSafe(attributes.maxStock),
      reorderLevel: toStringSafe(apiItem.reorderLevel),
      reorderQuantity: toStringSafe(attributes.reorderQuantity),
      stockLocation: toStringSafe(apiItem.storageLocation ?? attributes.storageLocation),
      abcClass: toStringSafe(attributes.abcClass),
      withdrawlPeriod: toStringSafe(attributes.withdrawlPeriod),
      stockType: toStringSafe(attributes.stockType),
      minStockAlert: toStringSafe(apiItem.minimumStock ?? attributes.minStockAlert),
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
      manufactureDate: toStringSafe(primaryBatch?.manufactureDate ?? attributes.manufactureDate),
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
      expiryWarningBefore: toStringSafe(
        primaryBatch?.expiryWarningBefore ?? attributes.expiryWarningBefore
      ),
      barcode: toStringSafe(primaryBatch?.barcode ?? attributes.barcode),
      _id: primaryBatch?._id,
      itemId: primaryBatch?.itemId,
      organisationId: primaryBatch?.organisationId,
      createdAt: primaryBatch?.createdAt,
      updatedAt: primaryBatch?.updatedAt,
    },
  };
};

const normalizeStatusForApi = (status?: string) => {
  const value = (status || '').toString().trim();
  if (!value) return 'ACTIVE';
  return value.replaceAll(/\s+/g, '_').toUpperCase();
};

export const buildBatchPayload = (batch: BatchValues): InventoryBatchPayload | undefined => {
  const batchRecord = batch as BatchValues & { current?: unknown; available?: unknown };
  const quantity = toNumberSafe(batch.quantity ?? batchRecord.current ?? batchRecord.available);
  const allocated = batch.allocated === '' ? undefined : toNumberSafe(batch.allocated);
  const normalizeDateForApi = (val?: string) => {
    if (!val) return undefined;
    if (val.includes('/')) {
      const [dd, mm, yyyy] = val.split('/');
      const parsed = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
    if (isoDateMatch) {
      const [, yyyy, mm, dd] = isoDateMatch;
      const parsed = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    const parsed = new Date(val);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
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
  const minShelfRaw = toStringSafe(batch.nextRefillDate ?? batch.minShelfLifeAlertDate);

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
  const itemType = normalizeItemTypeForApi(
    formData.classification.itemType ?? formData.basicInfo.itemType
  );
  const genericName = formData.classification.genericName?.trim() || undefined;
  const strength = formData.classification.strength?.trim() || undefined;
  const dosageForm =
    formData.classification.dosageForm?.trim() || formData.classification.form?.trim() || undefined;
  const routeOfAdministration = formData.classification.administration?.trim() || undefined;
  const prescriptionRequired = normalizeBooleanStringForApi(
    formData.classification.prescriptionRequired ?? formData.basicInfo.prescriptionRequired
  );
  const controlledItem = normalizeBooleanStringForApi(formData.classification.controlledSubstance);
  const storageInstructions =
    formData.classification.storageCondition?.trim() ||
    formData.basicInfo.storageCondition?.trim() ||
    undefined;
  const unitOfMeasureValue = formData.classification.unitofMeasure;
  const unitOfMeasure = Array.isArray(unitOfMeasureValue)
    ? unitOfMeasureValue[0]
    : unitOfMeasureValue?.trim() || undefined;
  const packageQuantity = toNumberSafe(formData.classification.packSize);
  const storageLocation = formData.stock.stockLocation?.trim() || undefined;
  const minimumStock = toNumberSafe(formData.stock.minStockAlert);
  const statusForApi = normalizeStatusForApi(formData.status ?? formData.basicInfo.status);

  const batchesSource =
    formData.batches && formData.batches.length > 0 ? formData.batches : [formData.batch];
  const batchPayloads = batchesSource
    .map((b) => buildBatchPayload(b))
    .filter(Boolean) as InventoryBatchPayload[];
  const batchTotals = calculateBatchTotals(batchesSource);
  const firstBatch = batchesSource[0];

  const attributes = cleanObject({
    department: formData.basicInfo.department,
    imageUrl: formData.basicInfo.imageUrl ?? formData.imageUrl,
    itemType: formData.classification.itemType ?? formData.basicInfo.itemType,
    drugSchedule: formData.classification.drugSchedule ?? formData.basicInfo.drugSchedule,
    prescriptionRequired:
      formData.classification.prescriptionRequired ?? formData.basicInfo.prescriptionRequired,
    controlledSubstance: formData.classification.controlledSubstance,
    reportableToGovernment: formData.classification.reportableToGovernment,
    regulationType: formData.basicInfo.regulationType,
    storageCondition:
      formData.classification.storageCondition ?? formData.basicInfo.storageCondition,
    productUsage: formData.basicInfo.productUsage,
    intendedUsage: formData.basicInfo.intendedUsage,
    coatType: formData.basicInfo.coatType,
    fragranceType: formData.basicInfo.fragranceType,
    allergenFree: formData.basicInfo.allergenFree,
    petSize: formData.basicInfo.petSize,
    animalStage: formData.basicInfo.animalStage,
    skuCode: formData.basicInfo.skuCode,
    ...formData.classification,
    brand: formData.basicInfo.brand ?? formData.vendor.brand,
    tax: formData.pricing.tax,
    maxDiscount: formData.pricing.maxDiscount,
    supplierName: formData.vendor.supplierName,
    vendor: formData.vendor.vendor,
    license: formData.vendor.license,
    paymentTerms: formData.vendor.paymentTerms,
    leadTime: formData.vendor.leadTime,
    stockLocation: formData.stock.stockLocation,
    stockType: formData.stock.stockType,
    maxStock: formData.stock.maxStock,
    abcClass: formData.stock.abcClass,
    withdrawlPeriod: formData.stock.withdrawlPeriod ?? formData.classification.withdrawlPeriod,
    minStockAlert: formData.stock.minStockAlert,
    reorderQuantity: formData.stock.reorderQuantity,
    available: batchTotals.available ?? toNumberSafe(formData.stock.available),
    expiryWarningBefore: firstBatch?.expiryWarningBefore,
    barcode: firstBatch?.barcode,
    serial: firstBatch?.serial ?? firstBatch?.barcode,
    tracking: firstBatch?.tracking,
    litterId: firstBatch?.litterId,
    nextRefillDate: firstBatch?.nextRefillDate,
  });

  const payload: InventoryRequestPayload = {
    organisationId,
    businessType,
    itemType,
    name: formData.basicInfo.name,
    sku: formData.basicInfo.skuCode || formData.sku,
    category: formData.basicInfo.category,
    subCategory: formData.basicInfo.subCategory,
    description: formData.basicInfo.description,
    imageUrl: formData.basicInfo.imageUrl ?? formData.imageUrl,
    genericName,
    strength,
    dosageForm,
    routeOfAdministration,
    prescriptionRequired,
    controlledItem,
    storageInstructions,
    unitOfMeasure,
    packageQuantity,
    storageLocation,
    minimumStock,
    attributes: {
      ...attributes,
      species: formData.classification.species,
      unitofMeasure: formData.classification.unitofMeasure,
    },
    onHand: batchTotals.onHand ?? toNumberSafe(formData.stock.current),
    allocated: batchTotals.allocated ?? toNumberSafe(formData.stock.allocated),
    // Backend create reads initialOnHand/initialAllocated for items without batches;
    // when batches exist the server recomputes these from the batch quantities.
    initialOnHand: batchTotals.onHand ?? toNumberSafe(formData.stock.current),
    initialAllocated: batchTotals.allocated ?? toNumberSafe(formData.stock.allocated),
    reorderLevel: toNumberSafe(formData.stock.reorderLevel),
    unitCost: toNumberSafe(formData.pricing.purchaseCost),
    sellingPrice: toNumberSafe(formData.pricing.selling),
    // Currency is derived server-side from the org billing settings; do not send a hardcoded value.
    vendorId: formData.vendor.vendor,
    status: formData.basicInfo.visibleInInventory === false ? 'HIDDEN' : statusForApi,
  };

  if (batchPayloads.length > 0) {
    payload.batches = batchPayloads;
  }

  return payload;
};

export const defaultFilters: InventoryFiltersState = {
  category: 'all',
  categories: [],
  subCategories: [],
  locations: [],
  abcClasses: [],
  suppliers: [],
  visibility: 'ALL',
  status: 'ALL',
  search: '',
};

export const displayStatusLabel = (item: InventoryItem): string => {
  const status = formatStatusLabel(item.status || item.basicInfo.status);
  if (status.toLowerCase() === 'hidden') return 'Hidden';
  const stockHealth = formatStockHealthLabel(item.stockHealth);
  if (stockHealth) return stockHealth;
  if (item.stock || item.batch) {
    const derived = getDerivedStockHealth(item);
    return derived.label || status || 'Active';
  }
  return status || 'Active';
};

export const getAvailableStock = (item: InventoryItem): number | undefined => {
  const onHand = toNumberSafe(item.stock?.current);
  const allocated = toNumberSafe(item.stock?.allocated) ?? 0;
  if (onHand === undefined) return undefined;
  return onHand - allocated;
};

export const getGrossProfitPerUnit = (item: InventoryItem): number | undefined => {
  const selling = toNumberSafe(item.pricing.selling);
  const unitCost = toNumberSafe(item.pricing.purchaseCost);
  if (selling === undefined || unitCost === undefined) return undefined;
  return selling - unitCost;
};

export const getMarginPercent = (item: InventoryItem): number | undefined => {
  const selling = toNumberSafe(item.pricing.selling);
  const profit = getGrossProfitPerUnit(item);
  if (selling === undefined || selling === 0 || profit === undefined) return undefined;
  return (profit / selling) * 100;
};

export const getMarkupPercent = (item: InventoryItem): number | undefined => {
  const unitCost = toNumberSafe(item.pricing.purchaseCost);
  const profit = getGrossProfitPerUnit(item);
  if (unitCost === undefined || unitCost === 0 || profit === undefined) return undefined;
  return (profit / unitCost) * 100;
};

export const getStockValue = (item: InventoryItem): number | undefined => {
  const onHand = toNumberSafe(item.stock.current);
  const unitCost = toNumberSafe(item.pricing.purchaseCost);
  if (onHand === undefined || unitCost === undefined) return undefined;
  return onHand * unitCost;
};

export const formatCurrencyValue = (value?: string | number, currency = 'USD') => {
  const num = toNumberSafe(value);
  if (num === undefined) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: Number.isInteger(num) ? 0 : 2,
    }).format(num);
  } catch {
    // Unknown/invalid ISO currency code — fall back to USD formatting.
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: Number.isInteger(num) ? 0 : 2,
    }).format(num);
  }
};

export const formatPercentValue = (value?: number) => {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${Number(value.toFixed(2))}%`;
};

export const getDerivedStockHealth = (
  item: InventoryItem
): { key: StockHealthStatus | 'IN_STOCK'; label: string } => {
  const status = normalizeStatus(item.status || item.basicInfo.status);
  if (status === 'HIDDEN') return { key: 'HEALTHY', label: 'Hidden' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = parseDateSafe(item.batch?.expiryDate);
  if (expiry && expiry.getTime() < today.getTime()) {
    return { key: 'EXPIRED', label: 'Expired' };
  }

  const available = getAvailableStock(item);
  const reorderPoint = toNumberSafe(item.stock?.reorderLevel);
  const maxStock = toNumberSafe(item.stock?.maxStock);
  if (available !== undefined && available <= 0) {
    return { key: 'OUT_OF_STOCK', label: 'Out of stock' };
  }
  if (available !== undefined && reorderPoint !== undefined && available <= reorderPoint) {
    return { key: 'LOW_STOCK', label: 'Low stock' };
  }
  const onHand = toNumberSafe(item.stock?.current);
  if (onHand !== undefined && maxStock !== undefined && onHand > maxStock) {
    return { key: 'OVERSTOCKED', label: 'Overstocked' };
  }

  return { key: 'IN_STOCK', label: 'In stock' };
};
