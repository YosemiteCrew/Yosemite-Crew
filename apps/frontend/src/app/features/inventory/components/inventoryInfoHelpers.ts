import { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import { formatDisplayDate } from '@/app/features/inventory/pages/Inventory/utils';

export const validateNumberField = (
  value: unknown,
  requiredMsg: string,
  numberMsg: string
): string | null => {
  if (value === '' || value === undefined) return requiredMsg;
  if (Number.isNaN(Number(value))) return numberMsg;
  return null;
};

export const getBasicInfoErrors = (
  values: Record<string, any>,
  inventory: InventoryItem
): Record<string, string> => {
  const errs: Record<string, string> = {};
  if (!values.name && !inventory.basicInfo.name) errs.name = 'Name is required';
  if (!values.category && !inventory.basicInfo.category) errs.category = 'Category is required';
  return errs;
};

export const getPricingErrors = (
  values: Record<string, any>,
  inventory: InventoryItem
): Record<string, string> => {
  const errs: Record<string, string> = {};
  const purchaseErr = validateNumberField(
    values.purchaseCost ?? inventory.pricing.purchaseCost,
    'Purchase cost is required',
    'Enter a valid number'
  );
  const sellingErr = validateNumberField(
    values.selling ?? inventory.pricing.selling,
    'Selling price is required',
    'Enter a valid number'
  );
  if (purchaseErr) errs.purchaseCost = purchaseErr;
  if (sellingErr) errs.selling = sellingErr;
  return errs;
};

export const getStockErrors = (
  values: Record<string, any>,
  inventory: InventoryItem
): Record<string, string> => {
  const errs: Record<string, string> = {};
  const currentErr = validateNumberField(
    values.current ?? inventory.stock.current,
    'On hand quantity is required',
    'Enter a valid number'
  );
  const reorderErr = validateNumberField(
    values.reorderLevel ?? inventory.stock.reorderLevel,
    'Reorder level is required',
    'Enter a valid number'
  );
  if (currentErr) errs.current = currentErr;
  if (reorderErr) errs.reorderLevel = reorderErr;
  return errs;
};

export const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  if (value.includes('/')) {
    const [dd, mm, yyyy] = value.split('/');
    const parsed = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    const parsed = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const normalizeOptions = (options?: Array<string | { label: string; value: string }>) =>
  options?.map((option: any) =>
    typeof option === 'string' ? { label: option, value: option } : option
  ) ?? [];

export const resolveLabel = (options: Array<{ label: string; value: string }>, value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

export const formatDateValue = (value?: string) => {
  return formatDisplayDate(value) || '—';
};

export const formatFinalValue = (display: string | string[]): string => {
  if (Array.isArray(display)) {
    return display.length > 0 ? display.join(', ') : '—';
  }
  if (display !== undefined && display !== '') {
    return String(display);
  }
  return '—';
};

export const getPrimaryButtonText = (
  inEditMode: boolean,
  isUpdating: boolean,
  isHiding: boolean,
  isHidden: boolean
): string => {
  if (inEditMode) {
    return isUpdating ? 'Saving...' : 'Save';
  }
  if (isHiding) {
    return isHidden ? 'Unhiding...' : 'Hiding...';
  }
  return isHidden ? 'Restore item' : 'Delete item';
};

export const getFieldDisplay = (
  component: string,
  value: any,
  normalizedOptions: any[]
): string | string[] => {
  if (component === 'multiSelect') {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      return value.split(',').map((v: string) => v.trim());
    }
    return [];
  }

  if (component === 'dropdown') {
    if (value !== undefined && value !== '') {
      return resolveLabel(normalizedOptions, String(value));
    }
    return '—';
  }

  if (component === 'date') {
    return formatDateValue(String(value ?? ''));
  }

  return String(value ?? '');
};
