import { CatalogItemType, PackageBreakdownItem } from '@/app/features/organization/types/revamp';
import { catalogApi } from '@/app/features/organization/services/catalogApiService';

export const LEAD_OPTIONS = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

export const STAFF_COUNT_OPTIONS = Array.from({ length: 6 }, (_, i) => ({
  value: String(i),
  label: String(i),
}));

export type FormErrors = Partial<Record<string, string>>;

export type CatalogEntry = {
  id: string;
  code?: string;
  name: string;
  type: CatalogItemType;
  unitPrice: number;
  currency?: string;
  defaultDiscount: number;
  maxDiscount: number;
  isBookable: boolean;
  isInpatientPreferred: boolean;
  nestedBreakdown?: PackageBreakdownItem[];
};

export type CatalogSearchResultItem = Awaited<ReturnType<typeof catalogApi.searchItems>>[number];

export const collectCatalogEntry = (
  entries: CatalogEntry[],
  item: CatalogSearchResultItem
): CatalogEntry[] => {
  if (!item.canBeAddedToPackage) return entries;
  const breakdownItem = catalogApi.mapSearchItem(item);
  entries.push({
    id: item.id,
    code: item.code ?? undefined,
    name: item.name,
    type: breakdownItem.type,
    unitPrice: item.unitPrice,
    currency: item.currency ?? undefined,
    defaultDiscount: item.defaultDiscountPercent,
    maxDiscount: item.maxDiscountPercent,
    isBookable: item.isBookable,
    isInpatientPreferred: false,
    nestedBreakdown: breakdownItem.nestedBreakdown,
  });
  return entries;
};

export const mapItemsToCatalog = (items: CatalogSearchResultItem[]): CatalogEntry[] =>
  items.reduce<CatalogEntry[]>((acc, item) => collectCatalogEntry(acc, item), []);

export const TYPE_LABELS: Record<string, string> = {
  CONSULTATION: 'Consultation',
  PROCEDURE: 'Procedure',
  LAB: 'Diagnostics',
  INVENTORY: 'Inventory',
  MEDICATION: 'Medication',
  PACKAGE: 'Package',
};
