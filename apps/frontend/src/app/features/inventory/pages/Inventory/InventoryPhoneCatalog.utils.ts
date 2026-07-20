import { InventoryItem } from './types';
import { displayStatusLabel, formatCurrencyValue, getMarginPercent, toNumberSafe } from './utils';

// Design abbreviates the stock unit ("6 u", "48 bx"); infer a rough packaging
// hint from the item name, defaulting to the generic "u" (mirrors the desktop
// table's getUnitAbbrev so a row and its phone card read the same unit).
export const getPhoneUnitAbbrev = (item: InventoryItem): string => {
  const raw = (item.basicInfo.name || '').toLowerCase();
  return /\bbox\b|\bbx\b|\bpack\b|\bpk\b|carton|\bcase\b/.test(raw) ? 'bx' : 'u';
};

/** Expiry as the design's compact `MM/YYYY`, or '' when the date is missing/invalid. */
export const formatExpiryShort = (value?: string): string => {
  if (!value) return '';
  let date: Date | null = null;
  if (value.includes('/')) {
    const parts = value.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      const [dd, mm, yyyy] = parts;
      const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }
  }
  if (!date) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${month}/${date.getFullYear()}`;
};

// Inventory numeric fields arrive as strings that are '' when absent; `Number('')`
// is 0, so an empty field would otherwise read as a real zero. Treat blank as
// missing so "0 u on hand" only shows for a genuine zero and cost-only pricing
// shows when there is no selling price.
const numericOrUndefined = (value?: string | number | null): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return toNumberSafe(value);
};

export type InventoryPhoneMeta = {
  statusLabel: string;
  statusKey: string;
  isLow: boolean;
  isExpired: boolean;
  isOutOfStock: boolean;
  restockEligible: boolean;
  code: string | null;
  onHandText: string | null;
  onHandAccent: 'warn' | 'danger' | 'ink';
  reorderText: string | null;
  locationText: string | null;
  expiryText: string | null;
  expiryDanger: boolean;
  priceText: string | null;
};

// Derives every value a phone card renders from the shared inventory helpers, so
// the card stays presentation-only and the mapping is unit-testable.
export const buildInventoryPhoneMeta = (item: InventoryItem): InventoryPhoneMeta => {
  const statusLabel = displayStatusLabel(item);
  const statusKey = statusLabel.toLowerCase();
  const isExpired = statusKey === 'expired';
  const isLow = statusKey === 'low stock';
  const isOutOfStock = statusKey === 'out of stock';
  const restockEligible = isLow || isOutOfStock;
  const unit = getPhoneUnitAbbrev(item);

  const code = (item.basicInfo.skuCode || item.sku || '').trim() || null;

  const currentRaw = numericOrUndefined(item.stock?.current);
  const onHandText = currentRaw === undefined ? null : `${currentRaw} ${unit}`;
  let onHandAccent: 'warn' | 'danger' | 'ink' = 'ink';
  if (isExpired || isOutOfStock) onHandAccent = 'danger';
  else if (isLow) onHandAccent = 'warn';

  const reorderRaw = numericOrUndefined(item.stock?.reorderLevel);
  const reorderText = isLow && reorderRaw !== undefined ? `reorder at ${reorderRaw}` : null;

  const locationText = (item.stock?.stockLocation || '').trim() || null;

  const expiryShort = formatExpiryShort(item.batch?.expiryDate);
  const expiryText = expiryShort ? `exp ${expiryShort}` : null;

  const pricing = item.pricing;
  const selling = numericOrUndefined(pricing?.selling);
  const cost = numericOrUndefined(pricing?.purchaseCost);
  // getMarginPercent dereferences item.pricing unguarded, so only ask for a
  // margin once we know pricing exists.
  const margin = pricing ? getMarginPercent(item) : undefined;
  let priceText: string | null = null;
  if (selling !== undefined && margin !== undefined) {
    priceText = `${formatCurrencyValue(pricing?.selling, item.currency)} · ${Math.round(margin)}%`;
  } else if (selling !== undefined) {
    priceText = formatCurrencyValue(pricing?.selling, item.currency);
  } else if (cost !== undefined) {
    priceText = `${formatCurrencyValue(pricing?.purchaseCost, item.currency)} cost`;
  }

  return {
    statusLabel,
    statusKey,
    isLow,
    isExpired,
    isOutOfStock,
    restockEligible,
    code,
    onHandText,
    onHandAccent,
    reorderText,
    locationText,
    expiryText,
    expiryDanger: isExpired,
    priceText,
  };
};
