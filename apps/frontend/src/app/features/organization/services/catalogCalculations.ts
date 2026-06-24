import {
  CatalogItemType,
  PackageBreakdownItem,
  PackageRevamp,
  ServiceRevamp,
} from '@/app/features/organization/types/revamp';

const CODE_PREFIXES: Record<CatalogItemType, string> = {
  CONSULTATION: 'CS',
  PROCEDURE: 'PR',
  INVENTORY: 'IN',
  LAB: 'LB',
  MEDICATION: 'ME',
  PACKAGE: 'PK',
};

let counters: Record<CatalogItemType, number> = {
  CONSULTATION: 0,
  PROCEDURE: 0,
  INVENTORY: 0,
  LAB: 0,
  MEDICATION: 0,
  PACKAGE: 0,
};

export const generateCode = (type: CatalogItemType): string => {
  counters[type] += 1;
  return `${CODE_PREFIXES[type]}-${String(counters[type]).padStart(4, '0')}`;
};

export const resetCounters = (init: Record<CatalogItemType, number>) => {
  counters = { ...init };
};

export const computePackageBreakdownItem = (item: PackageBreakdownItem) => {
  const gross = item.unitPrice * item.quantity;
  const discountAmt = (gross * item.discount) / 100;
  return { gross, discountAmt, net: gross - discountAmt };
};

export const computePackageTotals = (pkg: PackageRevamp) => {
  const grossTotal = pkg.breakdown.reduce((sum, item) => {
    return sum + item.unitPrice * item.quantity;
  }, 0);
  const afterItemDiscounts = pkg.breakdown.reduce((sum, item) => {
    const { net } = computePackageBreakdownItem(item);
    return sum + net;
  }, 0);
  const additionalDiscountAmt = (afterItemDiscounts * pkg.additionalDiscount) / 100;
  const computedTotal = afterItemDiscounts - additionalDiscountAmt;
  // List rows can arrive without a loaded breakdown (totals collapse to 0). Fall back to the
  // backend-computed final amount so the package cost still renders correctly everywhere.
  const totalCost =
    computedTotal > 0 || pkg.serverFinalAmount === undefined
      ? computedTotal
      : pkg.serverFinalAmount;
  return { grossTotal, afterItemDiscounts, additionalDiscountAmt, totalCost };
};

export const computeServiceTotal = (
  service: Pick<ServiceRevamp, 'grossAmount' | 'defaultDiscount'>
) => {
  const defaultDiscountAmt = (service.grossAmount * service.defaultDiscount) / 100;
  const total = service.grossAmount - defaultDiscountAmt;
  return { defaultDiscountAmt, total };
};
