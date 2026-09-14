'use client';
import React from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import { IoAddCircleOutline, IoEye } from 'react-icons/io5';
import InventoryCard from '@/app/ui/cards/InventoryCard';
import GenericTable, { type Column } from '@/app/ui/tables/GenericTable/GenericTable';
import PaginatedCardList from '@/app/ui/tables/PaginatedCardList';
import { InventoryItem } from '@/app/features/inventory/pages/Inventory/types';
import {
  displayStatusLabel,
  formatCurrencyValue,
  formatDisplayDate,
  formatPercentValue,
  getAvailableStock,
  getMarginPercent,
} from '@/app/features/inventory/pages/Inventory/utils';
import { getInventoryStatusTone } from '@/app/constants/status';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { getSafeOrgImageUrl } from '@/app/lib/urls';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';
import SharedStatusPill from '@/app/ui/primitives/StatusPill/StatusPill';

import './DataTable.css';

type InventoryTableProps = {
  filteredList: InventoryItem[];
  setActiveInventory: (inventory: InventoryItem) => void;
  setViewInventory: (open: boolean) => void;
  onView?: (inventory: InventoryItem) => void;
  onRestock?: (inventory: InventoryItem) => void;
};

const PAGE_SIZE = 8;

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

const InventoryStatusPill = ({ label }: { label: string }) => (
  <SharedStatusPill label={label} tone={getInventoryStatusTone(label)} />
);

const toCellTitle = (value?: string | null): string | undefined => {
  const title = value?.trim();
  return title || undefined;
};

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
        <div
          className="truncate text-[13px] font-bold leading-tight text-[var(--ink)]"
          title={item.basicInfo.name}
        >
          {item.basicInfo.name}
        </div>
        <div className="text-[11px] tabular-nums text-text-tertiary">{getSku(item)}</div>
      </div>
    </div>
  );
};

const RowActions = ({
  item,
  onView,
  onRestock,
  low,
}: {
  item: InventoryItem;
  onView: (item: InventoryItem) => void;
  onRestock?: (item: InventoryItem) => void;
  low: boolean;
}) => (
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
              : 'grid-row-action border text-text-secondary hover:bg-card-hover'
          )}
        >
          <IoAddCircleOutline size={15} />
        </button>
      </GlassTooltip>
    )}
    <GlassTooltip content="View details" side="top">
      <button
        type="button"
        onClick={() => onView(item)}
        aria-label={`View ${item.basicInfo.name}`}
        className="grid-row-action flex size-[30px] items-center justify-center rounded-full! border text-text-secondary transition-colors hover:bg-card-hover"
      >
        <IoEye size={14} />
      </button>
    </GlassTooltip>
  </div>
);

const buildColumns = (
  onView: (item: InventoryItem) => void,
  onRestock?: (item: InventoryItem) => void
): Column<InventoryItem>[] => [
  {
    label: 'Item',
    key: 'item',
    width: '300px',
    render: (item) => <ProductCell item={item} />,
  },
  {
    label: 'Category',
    key: 'category',
    width: '170px',
    render: (item) => (
      <div className="truncate text-[12.5px] text-text-secondary">
        {item.basicInfo.category || '—'}
        {item.basicInfo.subCategory ? ` / ${item.basicInfo.subCategory}` : ''}
      </div>
    ),
  },
  {
    label: 'Stock health',
    key: 'stockHealth',
    width: '128px',
    render: (item) => <InventoryStatusPill label={displayStatusLabel(item)} />,
  },
  {
    label: 'ABC',
    key: 'abc',
    width: '52px',
    render: (item) => (
      <div className="font-bold">{(item.stock.abcClass || '').replace('Class ', '') || '—'}</div>
    ),
  },
  {
    label: 'Expiry',
    key: 'expiry',
    width: '104px',
    render: (item) => {
      const expired = displayStatusLabel(item).toLowerCase() === 'expired';
      return (
        <div
          className={`text-[12.5px] tabular-nums ${expired ? 'cell-ink-danger font-bold' : 'cell-ink-success'}`}
        >
          {formatDisplayDate(item.batch.expiryDate) || '—'}
        </div>
      );
    },
  },
  {
    label: 'On hand',
    key: 'onHand',
    width: '88px',
    render: (item) => {
      const unit = getUnitAbbrev(item);
      return (
        <div className="text-right tabular-nums">
          {displayValue(item.stock.current || '') === '—' ? '—' : `${item.stock.current} ${unit}`}
        </div>
      );
    },
  },
  {
    label: 'Available',
    key: 'available',
    width: '88px',
    render: (item) => {
      const low = displayStatusLabel(item).toLowerCase() === 'low stock';
      const available = getAvailableStock(item);
      const unit = getUnitAbbrev(item);
      return (
        <div className={`text-right tabular-nums ${low ? 'cell-ink-warn font-bold' : ''}`}>
          {available === undefined ? '—' : `${available} ${unit}`}
        </div>
      );
    },
  },
  {
    label: 'Unit cost',
    key: 'unitCost',
    width: '88px',
    render: (item) => (
      <div className="text-right tabular-nums">
        {formatCurrencyValue(item.pricing.purchaseCost, item.currency)}
      </div>
    ),
  },
  {
    label: 'Selling',
    key: 'selling',
    width: '88px',
    render: (item) => (
      <div className="text-right tabular-nums">
        {formatCurrencyValue(item.pricing.selling, item.currency)}
      </div>
    ),
  },
  {
    label: 'Margin',
    key: 'margin',
    width: '78px',
    render: (item) => {
      const margin = getMarginPercent(item);
      return (
        <div
          className={`text-right tabular-nums ${margin === undefined ? 'text-text-tertiary' : 'cell-ink-success font-bold'}`}
        >
          {formatPercentValue(margin)}
        </div>
      );
    },
  },
  {
    label: 'Location',
    key: 'location',
    width: '100px',
    render: (item) => (
      <div
        className="cell-ink-link truncate text-[12.5px]"
        title={toCellTitle(item.stock.stockLocation)}
      >
        {displayValue(item.stock.stockLocation)}
      </div>
    ),
  },
  {
    label: '',
    key: 'actions',
    width: '96px',
    render: (item) => {
      const low = displayStatusLabel(item).toLowerCase() === 'low stock';
      return <RowActions item={item} onView={onView} onRestock={onRestock} low={low} />;
    },
  },
];

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

  const columns = buildColumns(handleViewInventory, onRestock);

  return (
    <div className="table-wrapper inventory-scroll-x h-full min-h-0 overflow-hidden">
      <div className="inventory-table-list h-full min-h-0 flex-1">
        <GenericTable
          data={filteredList}
          columns={columns}
          pagination
          pageSize={PAGE_SIZE}
          tableClassName="inventory-table-fixed"
          itemNoun="items"
          rowClassName={(item) =>
            displayStatusLabel(item).toLowerCase() === 'expired' ? 'inventory-row-expired' : ''
          }
        />
      </div>
      <PaginatedCardList
        items={filteredList}
        pageSize={PAGE_SIZE}
        className="inventory-card-list"
        listClassName="pb-2 sm:pb-3"
        itemNoun="items"
        renderCard={(item) => (
          <InventoryCard
            key={item.id ?? item.basicInfo.name}
            item={item}
            handleViewInventory={handleViewInventory}
          />
        )}
      />
    </div>
  );
};

export default InventoryTable;
