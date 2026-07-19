'use client';
import React from 'react';
import { IoAlertCircleOutline, IoCubeOutline } from 'react-icons/io5';
import clsx from 'clsx';

import { InventoryFiltersState, InventoryItem } from './types';
import {
  displayStatusLabel,
  formatCurrencyValue,
  getMarginPercent,
  getStatusBadgeStyle,
  toNumberSafe,
} from './utils';

const LOW_STOCK_STATUS = 'LOW_STOCK';

/**
 * Phone-only inventory catalog (< 768px). The desktop 12-column table has no
 * legible phone form, so below the phone breakpoint the page renders this
 * bespoke screen from the design: a horizontally-scrolling filter-pill row
 * (All · Low (n) · categories) over a single column of stock-health cards, each
 * with a status pill, a compact fact line and a Restock CTA on low/out-of-stock
 * items. The FAB (New product) and the record sheet come from the shared phone
 * shell + InventoryInfo; this component only owns the catalog list + pills.
 */

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

const ACCENT_VAR: Record<InventoryPhoneMeta['onHandAccent'], string> = {
  warn: 'var(--warn-text)',
  danger: 'var(--danger-text)',
  ink: 'var(--ink)',
};

const getCardBorder = (meta: InventoryPhoneMeta): React.CSSProperties => {
  if (meta.isExpired) {
    return { borderColor: 'var(--danger-border)', borderLeft: '3px solid var(--danger)' };
  }
  if (meta.restockEligible) {
    return { borderColor: 'var(--status-cancelled-border)', borderLeft: '3px solid var(--warn)' };
  }
  return { borderColor: 'var(--hairline)' };
};

type InventoryPhoneCardProps = {
  item: InventoryItem;
  onView: (item: InventoryItem) => void;
  onRestock?: (item: InventoryItem) => void;
  canRestock?: boolean;
};

export const InventoryPhoneCard = ({
  item,
  onView,
  onRestock,
  canRestock = false,
}: InventoryPhoneCardProps) => {
  const meta = buildInventoryPhoneMeta(item);
  const showRestock = Boolean(meta.restockEligible && canRestock && onRestock);

  return (
    <div
      className="flex flex-col gap-2 rounded-[16px] border bg-[var(--screen)] px-[14px] py-3 shadow-[0_1px_2px_var(--sh03),0_6px_16px_var(--sh05)]"
      style={getCardBorder(meta)}
    >
      <button
        type="button"
        onClick={() => onView(item)}
        aria-label={`View ${item.basicInfo.name}`}
        className="flex w-full flex-col gap-2 rounded-[10px] text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 text-[13.5px] font-bold leading-tight text-[var(--ink)]">
            {item.basicInfo.name}
            {meta.code && (
              <span className="font-medium text-[11px] text-[var(--ink-faint)]">
                {' '}
                · {meta.code}
              </span>
            )}
          </span>
          <span
            className="inline-flex flex-none items-center rounded-full border px-[9px] py-[3px] text-[9.5px] font-bold uppercase whitespace-nowrap"
            style={getStatusBadgeStyle(meta.statusLabel)}
          >
            {meta.statusLabel}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--ink-muted)]">
          {meta.onHandText && (
            <span>
              <b className="tabular-nums" style={{ color: ACCENT_VAR[meta.onHandAccent] }}>
                {meta.onHandText}
              </b>{' '}
              on hand
            </span>
          )}
          {meta.reorderText && <span>{meta.reorderText}</span>}
          {meta.locationText && <span>{meta.locationText}</span>}
          {meta.expiryText && (
            <span className={meta.expiryDanger ? 'font-bold text-[var(--danger-text)]' : undefined}>
              {meta.expiryText}
            </span>
          )}
          {meta.priceText && <span className="ml-auto tabular-nums">{meta.priceText}</span>}
        </span>
      </button>
      {showRestock && (
        <button
          type="button"
          onClick={() => onRestock?.(item)}
          aria-label={`Restock ${item.basicInfo.name}`}
          className="inline-flex h-[38px] w-full items-center justify-center gap-1.5 rounded-full! bg-[var(--cta)] text-[12px] font-bold text-[var(--cta-text)]"
        >
          <IoCubeOutline size={13} aria-hidden="true" />
          Restock
        </button>
      )}
    </div>
  );
};

const pillBase =
  'flex-none rounded-full! border px-[14px] py-2 text-[12px] transition-colors whitespace-nowrap';
const activePill = 'border-[var(--divider)] bg-[var(--inset)] font-bold text-[var(--ink)]';
const idlePill = 'border-[var(--hairline)] font-semibold text-[var(--ink-muted)]';

type InventoryPhoneFilterPillsProps = {
  filters: InventoryFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<InventoryFiltersState>>;
  categoryOptions: string[];
  toggleCategoryFilter?: (category: string) => void;
  lowStockCount: number;
};

export const InventoryPhoneFilterPills = ({
  filters,
  setFilters,
  categoryOptions,
  toggleCategoryFilter,
  lowStockCount,
}: InventoryPhoneFilterPillsProps) => {
  const selectedCategories = filters.categories ?? [];
  const selectedCategorySet = new Set(selectedCategories);
  const lowActive = filters.status === LOW_STOCK_STATUS;
  const allActive = selectedCategories.length === 0 && !lowActive;

  return (
    <div className="-mx-1 flex items-center gap-[7px] overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() =>
          setFilters((prev) => ({ ...prev, categories: [], category: 'all', status: 'ALL' }))
        }
        className={clsx(pillBase, allActive ? activePill : idlePill)}
      >
        All
      </button>
      <button
        type="button"
        aria-pressed={lowActive}
        onClick={() =>
          setFilters((prev) => ({
            ...prev,
            status: prev.status === LOW_STOCK_STATUS ? 'ALL' : LOW_STOCK_STATUS,
          }))
        }
        className={clsx(
          pillBase,
          'inline-flex items-center gap-[5px] border-[var(--status-cancelled-border)] bg-[var(--status-cancelled-bg)] font-bold text-[var(--status-cancelled-text)]',
          lowActive && 'shadow-[0_1px_3px_var(--sh08)]'
        )}
      >
        <IoAlertCircleOutline size={12} aria-hidden="true" />
        Low ({lowStockCount})
      </button>
      {categoryOptions.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => toggleCategoryFilter?.(category)}
          className={clsx(pillBase, selectedCategorySet.has(category) ? activePill : idlePill)}
        >
          {category}
        </button>
      ))}
    </div>
  );
};

type InventoryPhoneCatalogProps = {
  filteredInventory: InventoryItem[];
  filters: InventoryFiltersState;
  setFilters: React.Dispatch<React.SetStateAction<InventoryFiltersState>>;
  categoryOptions: string[];
  toggleCategoryFilter?: (category: string) => void;
  lowStockCount: number;
  loading?: boolean;
  onView: (item: InventoryItem) => void;
  onRestock?: (item: InventoryItem) => void;
  canRestock?: boolean;
};

const InventoryPhoneCatalog = ({
  filteredInventory,
  filters,
  setFilters,
  categoryOptions,
  toggleCategoryFilter,
  lowStockCount,
  loading = false,
  onView,
  onRestock,
  canRestock = false,
}: InventoryPhoneCatalogProps) => (
  <div className="flex w-full flex-col gap-[11px]">
    <InventoryPhoneFilterPills
      filters={filters}
      setFilters={setFilters}
      categoryOptions={categoryOptions}
      toggleCategoryFilter={toggleCategoryFilter}
      lowStockCount={lowStockCount}
    />
    {loading && filteredInventory.length === 0 ? (
      <div className="py-10 text-center text-[13px] text-[var(--ink-muted)]">
        Loading inventory…
      </div>
    ) : (
      <div className="flex flex-col gap-[9px]">
        {filteredInventory.length === 0 ? (
          <div className="rounded-[16px] border border-[var(--hairline)] bg-[var(--screen)] py-10 text-center text-[13px] text-[var(--ink-muted)]">
            Looks like a quiet day… for now.
          </div>
        ) : (
          filteredInventory.map((item) => (
            <InventoryPhoneCard
              key={item.id ?? item.basicInfo.name}
              item={item}
              onView={onView}
              onRestock={onRestock}
              canRestock={canRestock}
            />
          ))
        )}
      </div>
    )}
  </div>
);

export default InventoryPhoneCatalog;
