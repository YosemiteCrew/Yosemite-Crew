'use client';
import React from 'react';
import GenericTable from '@/app/ui/tables/GenericTable/GenericTable';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { InventoryTurnoverItem } from '@/app/features/inventory/pages/Inventory/types';
import InventoryTurnoverCard from '@/app/ui/cards/InventoryTurnoverCard';

import { formatTurnoverStatus, getInventoryTurnoverStatusStyle } from '@/app/ui/tables/tableUtils';

import './DataTable.css';
import { NoDataMessage } from '@/app/ui/tables/common';

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

/* Every metric column is sized by its HEADER, not its figures: the values are
   short integers but the labels are long, and the th is 10.5px/700 uppercase with
   1.05em tracking and nowrap+ellipsis. At the width where the colgroup actually
   binds (viewport 1300, table at its 1040px min-width) five of the nine headers
   were ellipsised on deployed dev - "Beginning inventory" by 34.5px, "Ending
   inventory" by 23.1, "Avg inventory" by 20.0, "Total purchases" by 15.7 and
   "Days on shelf" by 15.9, with "Turns/Year" left on 1px of slack. Widths below
   are the measured text width plus 22px of th padding plus ~8px of margin, the
   same allowance STATUS_COLUMN_WIDTH in InvoiceTable settles on after real-world
   font hinting and DPI variance ate a 4px one. */
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
      width: '172px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title cell-figure">{item.beginningInventory}</div>
      ),
    },
    {
      label: 'Ending inventory',
      key: 'Ending inventory',
      width: '152px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title cell-figure">{item.endingInventory}</div>
      ),
    },
    {
      label: 'Avg inventory',
      key: 'Avg inventory',
      width: '128px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title cell-figure">{getAverageInventory(item)}</div>
      ),
    },
    {
      label: 'Total purchases',
      key: 'Total purchases',
      width: '144px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title cell-figure">{getTotalPurchased(item)}</div>
      ),
    },
    {
      label: 'Turns/Year',
      key: 'Turns/Year',
      width: '108px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title cell-figure">{item.turnsPerYear}</div>
      ),
    },
    {
      label: 'Days on shelf',
      key: 'Days on shelf',
      width: '124px',
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title cell-figure">{item.daysOnShelf}</div>
      ),
    },
    {
      /* The one column sized by its BODY rather than its header: the label is 44px
         but the StatusPill inside is 10px/600 uppercase with 0.8px tracking and 20px
         of its own padding, so "Out of stock" needs 102.4px against the 69px content
         box a 100px column left it. Measured in the real pill font: Out of stock
         102.4, Excellent 82.5, Moderate 80.5, Healthy 69.4 - four of the five values
         overflowed, and StatusPill is nowrap + overflow-hidden, so it clipped the
         word rather than wrapping it. */
      label: 'Status',
      key: 'status',
      width: '140px',
      render: (item: InventoryTurnoverItem) => (
        <StatusPill
          style={getInventoryTurnoverStatusStyle(item.status)}
          label={formatTurnoverStatus(item.status)}
        />
      ),
    },
  ];

  return (
    <div className="table-wrapper inventory-turnover-scroll-x h-full min-h-0 overflow-hidden">
      <div className="table-list hidden xl:flex h-full min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        <GenericTable
          itemNoun="items"
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
              <NoDataMessage
                title="No turnover to report"
                subtitle="Turnover appears once stock has moved in this period."
              />
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
