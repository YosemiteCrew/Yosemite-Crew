'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { IoCubeOutline, IoEye } from 'react-icons/io5';
import InventoryCard from '@/app/ui/cards/InventoryCard';
import Back from '@/app/ui/primitives/Icons/Back';
import Next from '@/app/ui/primitives/Icons/Next';
import { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import {
  displayStatusLabel,
  formatCurrencyValue,
  formatDisplayDate,
  formatPercentValue,
  getAvailableStock,
  getMarginPercent,
} from '@/app/features/inventory/pages/Inventory/utils';
import { getInventoryStatusStyle } from '@/app/ui/tables/tableUtils';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { getSafeOrgImageUrl } from '@/app/lib/urls';

import './DataTable.css';

type InventoryTableProps = {
  filteredList: InventoryItem[];
  setActiveInventory: (inventory: InventoryItem) => void;
  setViewInventory: (open: boolean) => void;
  onView?: (inventory: InventoryItem) => void;
  onRestock?: (inventory: InventoryItem) => void;
};

const PAGE_SIZE = 8;

// Design column track (item · category · health · abc · expiry · on-hand ·
// available · unit cost · selling · margin · location · actions).
const GRID_COLUMNS = '1.7fr 1fr 110px 46px 96px 84px 84px 84px 84px 74px 96px 96px';

const HEADER_CELLS: { label: string; align?: 'right' }[] = [
  { label: 'Item' },
  { label: 'Category' },
  { label: 'Stock health' },
  { label: 'ABC' },
  { label: 'Expiry' },
  { label: 'On hand', align: 'right' },
  { label: 'Available', align: 'right' },
  { label: 'Unit cost', align: 'right' },
  { label: 'Selling', align: 'right' },
  { label: 'Margin', align: 'right' },
  { label: 'Location' },
  { label: '' },
];

const displayValue = (val?: string | number | null) => {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'string' && val.trim() === '') return '—';
  return val;
};

const getSku = (item: InventoryItem) => item.basicInfo.skuCode || item.sku || '—';

const getImageFallback = (item: InventoryItem) => {
  const category = item.basicInfo.category.toLowerCase();
  if (category.includes('surgical') || category.includes('consumable')) return '🧤';
  if (category.includes('food')) return '🥫';
  if (category.includes('equipment')) return '🧰';
  return '💊';
};

const getInventoryImageSrc = (item: InventoryItem) =>
  getSafeOrgImageUrl(item.basicInfo.imageUrl || item.imageUrl);

const StatusPill = ({ label }: { label: string }) => (
  <span
    className="inline-flex items-center rounded-full border px-2.5 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.06em] whitespace-nowrap"
    style={getInventoryStatusStyle(label)}
  >
    {label}
  </span>
);

const ProductCell = ({ item }: { item: InventoryItem }) => {
  const imageSrc = getInventoryImageSrc(item);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex size-[38px] shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-[var(--inset)] text-base">
        {imageSrc ? (
          <Image src={imageSrc} alt="" width={38} height={38} className="size-full object-cover" />
        ) : (
          <span aria-hidden="true">{getImageFallback(item)}</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold leading-tight text-text-primary">
          {item.basicInfo.name}
        </div>
        <div className="text-[11px] tabular-nums text-text-tertiary">{getSku(item)}</div>
      </div>
    </div>
  );
};

const InventoryRow = ({
  item,
  onView,
  onRestock,
}: {
  item: InventoryItem;
  onView: (item: InventoryItem) => void;
  onRestock?: (item: InventoryItem) => void;
}) => {
  const statusLabel = displayStatusLabel(item);
  const statusKey = statusLabel.toLowerCase();
  const expired = statusKey === 'expired';
  const low = statusKey === 'low stock';
  const available = getAvailableStock(item);
  const margin = getMarginPercent(item);
  const expiryLabel = formatDisplayDate(item.batch.expiryDate) || '—';

  return (
    <div
      className="grid items-center gap-2.5 border-t border-card-border px-5 py-2.5 text-[13px] text-text-primary transition-colors hover:bg-[var(--surface-soft)]"
      style={{
        gridTemplateColumns: GRID_COLUMNS,
        backgroundColor: expired
          ? 'color-mix(in srgb, var(--color-danger-500) 9%, transparent)'
          : undefined,
      }}
    >
      <ProductCell item={item} />
      <div className="truncate text-[12.5px] text-text-secondary">
        {item.basicInfo.category || '—'}
        {item.basicInfo.subCategory ? ` / ${item.basicInfo.subCategory}` : ''}
      </div>
      <div>
        <StatusPill label={statusLabel} />
      </div>
      <div className="font-bold">{(item.stock.abcClass || '').replace('Class ', '') || '—'}</div>
      <div
        className={`text-[12.5px] tabular-nums ${
          expired
            ? 'font-bold text-[var(--color-danger-600)]'
            : 'text-[var(--color-pill-success-text)]'
        }`}
      >
        {expiryLabel}
      </div>
      <div className="text-right tabular-nums">
        {displayValue(item.stock.current || '') === '—' ? '—' : `${item.stock.current} units`}
      </div>
      <div
        className={`text-right tabular-nums ${low ? 'font-bold text-[var(--color-pill-warning-text)]' : ''}`}
      >
        {available ?? '—'}
      </div>
      <div className="text-right tabular-nums">
        {formatCurrencyValue(item.pricing.purchaseCost, item.currency)}
      </div>
      <div className="text-right tabular-nums">
        {formatCurrencyValue(item.pricing.selling, item.currency)}
      </div>
      <div
        className={`text-right tabular-nums ${
          margin === undefined
            ? 'text-text-tertiary'
            : 'font-bold text-[var(--color-pill-success-text)]'
        }`}
      >
        {formatPercentValue(margin)}
      </div>
      <div className="truncate text-[12.5px] text-blue-text">
        {displayValue(item.stock.stockLocation)}
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {onRestock && (
          <GlassTooltip content="Restock" side="top">
            <button
              type="button"
              onClick={() => onRestock(item)}
              aria-label={`Restock ${item.basicInfo.name}`}
              className={`flex size-[30px] items-center justify-center rounded-full! transition-colors ${
                low
                  ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active)]'
                  : 'border border-card-border text-text-secondary hover:bg-card-hover'
              }`}
            >
              <IoCubeOutline size={16} />
            </button>
          </GlassTooltip>
        )}
        <GlassTooltip content="View details" side="top">
          <button
            type="button"
            onClick={() => onView(item)}
            aria-label={`View ${item.basicInfo.name}`}
            className="flex size-[30px] items-center justify-center rounded-full! border border-card-border text-text-secondary transition-colors hover:bg-card-hover"
          >
            <IoEye size={15} />
          </button>
        </GlassTooltip>
      </div>
    </div>
  );
};

const InventoryTable = ({
  filteredList,
  setActiveInventory,
  setViewInventory,
  onView,
  onRestock,
}: InventoryTableProps) => {
  const [page, setPage] = useState(1);

  const handleViewInventory = (inventory: InventoryItem) => {
    if (onView) {
      onView(inventory);
      return;
    }
    setActiveInventory(inventory);
    setViewInventory(true);
  };

  const total = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  if (currentPage !== page) setPage(currentPage);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredList.slice(startIdx, startIdx + PAGE_SIZE);
  const showPagination = totalPages > 1;

  return (
    <div className="table-wrapper inventory-scroll-x h-full min-h-0 overflow-hidden">
      <div className="inventory-table-list h-full min-h-0 flex-1">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="min-w-[1080px]">
              <div
                className="sticky top-0 z-10 grid items-center gap-2.5 bg-[var(--screen-2)] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.09em] text-text-tertiary"
                style={{ gridTemplateColumns: GRID_COLUMNS }}
              >
                {HEADER_CELLS.map((cell, index) => (
                  <span
                    key={cell.label || `col-${index}`}
                    className={cell.align === 'right' ? 'text-right' : ''}
                  >
                    {cell.label}
                  </span>
                ))}
              </div>
              {total === 0 ? (
                <div className="flex w-full items-center justify-center border-t border-card-border py-10 text-body-4 text-text-primary">
                  Looks like a quiet day… for now.
                </div>
              ) : (
                pageRows.map((item) => (
                  <InventoryRow
                    key={item.id ?? item.basicInfo.name}
                    item={item}
                    onView={handleViewInventory}
                    onRestock={onRestock}
                  />
                ))
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between border-t border-card-border px-5 py-3 text-[12.5px] text-text-tertiary">
            <span>
              {total === 0
                ? 'No items'
                : `Showing ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, total)} of ${total} items`}
            </span>
            {showPagination && (
              <span className="flex items-center gap-2">
                <Back
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={currentPage === 1 ? 'cursor-not-allowed opacity-40' : ''}
                />
                <span className="tabular-nums text-text-secondary">
                  {currentPage} / {totalPages}
                </span>
                <Next
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={currentPage === totalPages ? 'cursor-not-allowed opacity-40' : ''}
                />
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="inventory-card-list gap-4 sm:gap-6 flex-wrap">
        {total === 0 ? (
          <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
            No data available
          </div>
        ) : (
          filteredList.map((item: InventoryItem) => (
            <InventoryCard
              key={item.id ?? item.basicInfo.name}
              item={item}
              handleViewInventory={handleViewInventory}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default InventoryTable;
