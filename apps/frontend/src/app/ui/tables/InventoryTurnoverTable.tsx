'use client';
import React from 'react';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { InventoryTurnoverItem } from '@/app/features/inventory/pages/Inventory/types';
import InventoryTurnoverCard from '@/app/ui/cards/InventoryTurnoverCard';

import './DataTable.css';

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type InventoryTurnoverTableProps = {
  filteredList: InventoryTurnoverItem[];
};

export const getStatusStyle = (status?: string) => {
  const key = (status || '').toLowerCase();
  switch (key) {
    case 'excellent':
    case 'healthy':
      return {
        color: 'var(--color-pill-success-text)',
        backgroundColor: 'var(--color-pill-success-bg)',
        borderColor: 'var(--color-pill-success-border)',
      };
    case 'low':
    case 'out of stock':
      return {
        color: 'var(--color-pill-warning-text)',
        backgroundColor: 'var(--color-pill-warning-bg)',
        borderColor: 'var(--color-pill-warning-border)',
      };
    case 'moderate':
      return {
        color: 'var(--color-pill-progress-text)',
        backgroundColor: 'var(--color-pill-progress-bg)',
        borderColor: 'var(--color-pill-progress-border)',
      };
    default:
      return {
        color: 'var(--color-pill-neutral-text)',
        backgroundColor: 'var(--color-pill-neutral-bg)',
        borderColor: 'var(--color-pill-neutral-border)',
      };
  }
};

export const formatTurnoverStatus = (status?: string) => {
  const label = (status || '').toString().trim();
  if (!label) return '—';
  return label
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const InventoryTurnoverTable = ({ filteredList }: InventoryTurnoverTableProps) => {
  const getAverageInventory = (item: InventoryTurnoverItem) =>
    item.averageInventory ?? item.avgInventory ?? 0;

  const getTotalPurchased = (item: InventoryTurnoverItem) =>
    item.totalPurchases ?? item.totalPurchased ?? 0;

  const columns: Column<InventoryTurnoverItem>[] = [
    {
      label: 'Item name',
      key: 'name',
      width: '15%',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.name}</div>
      ),
    },
    {
      label: 'Category',
      key: 'category',
      width: '10%',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.category}</div>
      ),
    },
    {
      label: 'Beginning inventory',
      key: 'Beginning inventory',
      width: '10%',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.beginningInventory}</div>
      ),
    },
    {
      label: 'Ending inventory',
      key: 'Ending inventory',
      width: '10%',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.endingInventory}</div>
      ),
    },
    {
      label: 'Avg inventory',
      key: 'Avg inventory',
      width: '10%',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{getAverageInventory(item)}</div>
      ),
    },
    {
      label: 'Total purchases',
      key: 'Total purchases',
      width: '10%',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{getTotalPurchased(item)}</div>
      ),
    },
    {
      label: 'Turns/Year',
      key: 'Turns/Year',
      width: '10%',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.turnsPerYear}</div>
      ),
    },
    {
      label: 'Days on shelf',
      key: 'Days on shelf',
      width: '10%',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.daysOnShelf}</div>
      ),
    },
    {
      label: 'Status',
      key: 'status',
      width: '15%',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-status" style={getStatusStyle(item.status)}>
          {formatTurnoverStatus(item.status)}
        </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper h-full min-h-0 overflow-hidden">
      <div className="table-list hidden xl:flex h-full min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={5}
        />
      </div>
      <div className="card-list flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {(() => {
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                No data available
              </div>
            );
          }
          return filteredList.map((item: any) => (
            <InventoryTurnoverCard key={item.name} item={item} />
          ));
        })()}
      </div>
    </div>
  );
};

export default InventoryTurnoverTable;
