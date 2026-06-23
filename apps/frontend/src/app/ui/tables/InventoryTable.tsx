'use client';
import React from 'react';
import Image from 'next/image';
import { IoEye } from 'react-icons/io5';
import { LuPackagePlus } from 'react-icons/lu';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import InventoryCard from '@/app/ui/cards/InventoryCard';
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

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type InventoryTableProps = {
  filteredList: InventoryItem[];
  setActiveInventory: (inventory: InventoryItem) => void;
  setViewInventory: (open: boolean) => void;
  onView?: (inventory: InventoryItem) => void;
  onRestock?: (inventory: InventoryItem) => void;
};

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

  const columns: Column<InventoryItem>[] = [
    {
      label: 'Item name',
      key: 'name',
      width: '190px',
      render: (item: InventoryItem) => (
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card-hover text-xl">
            {(() => {
              const imageSrc = getInventoryImageSrc(item);
              if (!imageSrc) {
                return <span aria-hidden="true">{getImageFallback(item)}</span>;
              }
              return (
                <Image
                  src={imageSrc}
                  alt=""
                  width={48}
                  height={48}
                  className="size-full object-cover"
                />
              );
            })()}
          </div>
          <div className="min-w-0">
            <div className="appointment-profile-title whitespace-normal leading-tight">
              {item.basicInfo.name}
            </div>
            <div className="text-caption-1 text-text-secondary">{getSku(item)}</div>
          </div>
        </div>
      ),
    },
    {
      label: 'Category/Sub-category',
      key: 'category',
      width: '125px',
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title whitespace-normal">
          {item.basicInfo.category || '—'}
          {item.basicInfo.subCategory ? `/${item.basicInfo.subCategory}` : ''}
        </div>
      ),
    },
    {
      label: 'Stock health',
      key: 'stock-health',
      width: '110px',
      render: (item: InventoryItem) => (
        <div
          className="appointment-status"
          style={getInventoryStatusStyle(displayStatusLabel(item))}
        >
          {displayStatusLabel(item)}
        </div>
      ),
    },
    {
      label: 'ABC',
      key: 'abc',
      width: '48px',
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {(item.stock.abcClass || '').replace('Class ', '') || '—'}
        </div>
      ),
    },
    {
      label: 'Expiry date',
      key: 'expiry',
      width: '92px',
      render: (item: InventoryItem) => {
        const label = formatDisplayDate(item.batch.expiryDate) || '—';
        const expired = displayStatusLabel(item).toLowerCase() === 'expired';
        return (
          <div
            className={`appointment-profile-title ${expired ? 'text-text-error' : 'text-[var(--color-pill-success-text)]'}`}
          >
            {label}
          </div>
        );
      },
    },
    {
      label: 'On hand',
      key: 'on-hand',
      width: '76px',
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {displayValue(item.stock.current || '') === '—' ? '—' : `${item.stock.current} units`}
        </div>
      ),
    },
    {
      label: 'Available',
      key: 'available',
      width: '76px',
      render: (item: InventoryItem) => {
        const value = getAvailableStock(item);
        const low = displayStatusLabel(item).toLowerCase() === 'low stock';
        return (
          <div className={`appointment-profile-title ${low ? 'text-orange-600' : ''}`}>
            {value ?? '—'}
          </div>
        );
      },
    },
    {
      label: 'Unit cost',
      key: 'unit-cost',
      width: '76px',
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {formatCurrencyValue(item.pricing.purchaseCost, item.currency)}
        </div>
      ),
    },
    {
      label: 'Selling price',
      key: 'selling-price',
      width: '82px',
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {formatCurrencyValue(item.pricing.selling, item.currency)}
        </div>
      ),
    },
    {
      label: 'Margin',
      key: 'margin',
      width: '78px',
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title text-[var(--color-pill-success-text)]">
          {formatPercentValue(getMarginPercent(item))}
        </div>
      ),
    },
    {
      label: 'Location',
      key: 'location',
      width: '86px',
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title text-blue-text">
          {displayValue(item.stock.stockLocation)}
        </div>
      ),
    },
    {
      label: 'Actions',
      key: 'actions',
      width: '104px',
      render: (item: InventoryItem) => (
        <div className="action-btn-col">
          {onRestock && (
            <GlassTooltip content="Restock" side="top">
              <button
                type="button"
                onClick={() => onRestock(item)}
                aria-label={`Restock ${item.basicInfo.name}`}
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
              >
                <LuPackagePlus size={20} color="var(--color-neutral-900)" />
              </button>
            </GlassTooltip>
          )}
          <GlassTooltip content="View details" side="top">
            <button
              type="button"
              onClick={() => handleViewInventory(item)}
              aria-label={`View ${item.basicInfo.name}`}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
            >
              <IoEye size={20} color="var(--color-neutral-900)" />
            </button>
          </GlassTooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper inventory-scroll-x h-full min-h-0 overflow-hidden">
      <div className="inventory-table-list h-full min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={5}
          tableClassName="inventory-table-fixed"
        />
      </div>
      <div className="inventory-card-list gap-4 sm:gap-6 flex-wrap">
        {(() => {
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                No data available
              </div>
            );
          }
          return filteredList.map((item: InventoryItem) => (
            <InventoryCard
              key={item.id ?? item.basicInfo.name}
              item={item}
              handleViewInventory={handleViewInventory}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default InventoryTable;
