'use client';
import React from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { IoAddCircleOutline, IoEye } from 'react-icons/io5';
import InventoryCard from '@/app/ui/cards/InventoryCard';
import PaginatedGridTable, { GridHeaderCell } from '@/app/ui/tables/PaginatedGridTable';
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
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

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

const HEADER_CELLS: GridHeaderCell[] = [
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
  { label: 'Location', className: 'pl-3' },
  { label: '' },
];

const displayValue = (val?: string | number | null) => {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'string' && val.trim() === '') return '—';
  return val;
};

const getSku = (item: InventoryItem) => item.basicInfo.skuCode || item.sku || '—';

// Design abbreviates the stock unit ("6 u", "48 bx"); infer a rough packaging
// hint from the item name, defaulting to the generic "u".
const getUnitAbbrev = (item: InventoryItem) => {
  const raw = (item.basicInfo.name || '').toLowerCase();
  return /\bbox\b|\bbx\b|\bpack\b|\bpk\b|carton|\bcase\b/.test(raw) ? 'bx' : 'u';
};

const getImageFallback = (item: InventoryItem) => {
  const category = item.basicInfo.category.toLowerCase();
  if (category.includes('surgical') || category.includes('consumable')) return '🧤';
  if (category.includes('food')) return '🥫';
  if (category.includes('equipment')) return '🧰';
  return '💊';
};

// next/image throws when the host is outside next.config's allowlist. Inventory
// images are org uploads stored as S3 keys, so anything that does not resolve to
// the org CDN falls back to the category emoji instead of taking the page down.
const ORG_IMAGE_URL_PREFIX = MEDIA_SOURCES.organization.fromS3Key('');

const getInventoryImageSrc = (item: InventoryItem) => {
  const src = getSafeOrgImageUrl(item.basicInfo.imageUrl || item.imageUrl);
  return src.startsWith(ORG_IMAGE_URL_PREFIX) ? src : '';
};

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
  const unit = getUnitAbbrev(item);

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
        {displayValue(item.stock.current || '') === '—' ? '—' : `${item.stock.current} ${unit}`}
      </div>
      <div
        className={`text-right tabular-nums ${low ? 'font-bold text-[var(--color-pill-warning-text)]' : ''}`}
      >
        {available === undefined ? '—' : `${available} ${unit}`}
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
      <div className="truncate pl-3 text-[12.5px] text-blue-text">
        {displayValue(item.stock.stockLocation)}
      </div>
      <div className="flex items-center justify-center gap-1.5">
        {onRestock && (
          <GlassTooltip content="Restock" side="top">
            <button
              type="button"
              onClick={() => onRestock(item)}
              aria-label={`Restock ${item.basicInfo.name}`}
              className={clsx(
                'flex size-[30px] items-center justify-center rounded-full! transition-colors',
                low
                  ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active)]'
                  : 'border border-card-border text-text-secondary hover:bg-card-hover'
              )}
            >
              <IoAddCircleOutline size={16} />
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
  const handleViewInventory = (inventory: InventoryItem) => {
    if (onView) {
      onView(inventory);
      return;
    }
    setActiveInventory(inventory);
    setViewInventory(true);
  };

  return (
    <PaginatedGridTable
      rows={filteredList}
      pageSize={PAGE_SIZE}
      gridColumns={GRID_COLUMNS}
      headerCells={HEADER_CELLS}
      itemNoun="items"
      renderRow={(item) => (
        <InventoryRow
          key={item.id ?? item.basicInfo.name}
          item={item}
          onView={handleViewInventory}
          onRestock={onRestock}
        />
      )}
      renderCard={(item) => (
        <InventoryCard
          key={item.id ?? item.basicInfo.name}
          item={item}
          handleViewInventory={handleViewInventory}
        />
      )}
    />
  );
};

export default InventoryTable;
