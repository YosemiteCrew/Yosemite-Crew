import React from "react";
import {
  formatTurnoverStatus,
  getStatusStyle,
} from "../../DataTable/InventoryTurnoverTable";

const InventoryTurnoverCard = ({ item }: any) => {
  const averageInventory = item.averageInventory ?? item.avgInventory ?? 0;
  const totalPurchased = item.totalPurchases ?? item.totalPurchased ?? 0;

  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-[23px] font-satoshi font-bold text-black-text">
          {item.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Category:</div>
        <div className="text-caption-1 text-text-primary">{item.category}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">
          Beginning inventory:
        </div>
        <div className="text-caption-1 text-text-primary">
          {item.beginningInventory}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Ending inventory:</div>
        <div className="text-caption-1 text-text-primary">
          {item.endingInventory}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Avg inventory:</div>
        <div className="text-caption-1 text-text-primary">
          {averageInventory}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Total purchases:</div>
        <div className="text-caption-1 text-text-primary">{totalPurchased}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Turns/Year:</div>
        <div className="text-caption-1 text-text-primary">
          {item.turnsPerYear}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Days on shelf:</div>
        <div className="text-caption-1 text-text-primary">
          {item.daysOnShelf}
        </div>
      </div>
      <div
        style={getStatusStyle(item.status)}
        className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
      >
        {formatTurnoverStatus(item.status)}
      </div>
    </div>
  );
};

export default InventoryTurnoverCard;
