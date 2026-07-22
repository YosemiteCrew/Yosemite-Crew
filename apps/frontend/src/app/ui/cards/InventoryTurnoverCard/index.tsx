import React from 'react';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { formatTurnoverStatus, getInventoryTurnoverStatusStyle } from '@/app/ui/tables/tableUtils';

const InventoryTurnoverCard = ({ item }: any) => {
  const averageInventory = item.averageInventory ?? item.avgInventory ?? 0;
  const totalPurchased = item.totalPurchases ?? item.totalPurchased ?? 0;

  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] p-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">{item.name}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Category:</div>
        <div className="text-caption-1 text-text-primary">{item.category}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Beginning inventory:</div>
        <div className="text-caption-1 text-text-primary">{item.beginningInventory}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Ending inventory:</div>
        <div className="text-caption-1 text-text-primary">{item.endingInventory}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Avg inventory:</div>
        <div className="text-caption-1 text-text-primary">{averageInventory}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Total purchases:</div>
        <div className="text-caption-1 text-text-primary">{totalPurchased}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Turns/Year:</div>
        <div className="text-caption-1 text-text-primary">{item.turnsPerYear}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Days on shelf:</div>
        <div className="text-caption-1 text-text-primary">{item.daysOnShelf}</div>
      </div>
      <StatusPill
        style={getInventoryTurnoverStatusStyle(item.status)}
        label={formatTurnoverStatus(item.status)}
      />
    </div>
  );
};

export default InventoryTurnoverCard;
