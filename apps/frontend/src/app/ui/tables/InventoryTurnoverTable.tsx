'use client';
import React from 'react';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import { InventoryTurnoverItem } from '@/app/features/inventory/pages/Inventory/types';
import InventoryTurnoverCard from '@/app/ui/cards/InventoryTurnoverCard';

import { formatTurnoverStatus, getInventoryTurnoverStatusStyle } from '@/app/ui/tables/tableUtils';

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

const getAverageInventory = (item: InventoryTurnoverItem) =>
  item.averageInventory ?? item.avgInventory ?? 0;

const getTotalPurchased = (item: InventoryTurnoverItem) =>
  item.totalPurchases ?? item.totalPurchased ?? 0;

const InventoryTurnoverTable = ({ filteredList }: InventoryTurnoverTableProps) => {
  const columns: Column<InventoryTurnoverItem>[] = [
    {
      label: 'Item name',
      key: 'name',
      width: '160px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.name}</div>
      ),
    },
    {
      label: 'Category',
      key: 'category',
      width: '110px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.category}</div>
      ),
    },
    {
      label: 'Beginning inventory',
      key: 'Beginning inventory',
      width: '130px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.beginningInventory}</div>
      ),
    },
    {
      label: 'Ending inventory',
      key: 'Ending inventory',
      width: '120px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.endingInventory}</div>
      ),
    },
    {
      label: 'Avg inventory',
      key: 'Avg inventory',
      width: '100px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{getAverageInventory(item)}</div>
      ),
    },
    {
      label: 'Total purchases',
      key: 'Total purchases',
      width: '120px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{getTotalPurchased(item)}</div>
      ),
    },
    {
      label: 'Turns/Year',
      key: 'Turns/Year',
      width: '100px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.turnsPerYear}</div>
      ),
    },
    {
      label: 'Days on shelf',
      key: 'Days on shelf',
      width: '100px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.daysOnShelf}</div>
      ),
    },
    {
      label: 'Status',
      key: 'status',
      width: '100px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-status" style={getInventoryTurnoverStatusStyle(item.status)}>
          {formatTurnoverStatus(item.status)}
        </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper inventory-turnover-scroll-x h-full min-h-0 overflow-hidden">
      <div className="table-list hidden xl:flex h-full min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={10}
          tableClassName="inventory-turnover-table-fixed"
        />
      </div>
      <div className="card-list flex xl:hidden gap-4 sm:gap-6 flex-wrap">
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
