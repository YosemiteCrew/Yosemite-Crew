'use client';
import React from 'react';
import { IoAlertCircleOutline, IoCubeOutline } from 'react-icons/io5';
import clsx from 'clsx';

import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { InventoryFiltersState, InventoryItem } from './types';
import { getStatusBadgeStyle } from './utils';
import { buildInventoryPhoneMeta, type InventoryPhoneMeta } from './InventoryPhoneCatalog.utils';
import { NoDataMessage, emptyStateCopy } from '@/app/ui/tables/common';

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
          <StatusPill
            label={meta.statusLabel}
            style={getStatusBadgeStyle(meta.statusLabel)}
            className="flex-none"
          />
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
const activePill =
  'border-[var(--chip-selected-border)] bg-[var(--chip-selected-bg)] font-bold text-[var(--chip-selected-ink)]';
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
          /* Was a hardcoded "Looks like a quiet day… for now." — the sentence the
             inventory TABLE used to show, kept here by hand and left behind when
             that table moved to copy derived from its own noun. Derived from the
             same helper now, so the phone catalogue and the table agree. */
          <div className="rounded-[16px] border border-[var(--hairline)] bg-[var(--screen)] py-10 text-center">
            <NoDataMessage {...emptyStateCopy('items')} />
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
