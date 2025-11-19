import React from "react";
import { getStatusStyle } from "../../DataTable/InventoryTurnoverTable";

const InventoryTurnoverCard = ({ item }: any) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-[23px] font-satoshi font-bold text-black-text">
          {item.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Category:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {item.category}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Beginning inventory:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {item.beginningInventory}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Ending inventory:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {item.endingInventory}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Avg inventory:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {item.averageInventory}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Total purchases:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {"$ " + item.totalPurchases}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Turns/Year:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {item.turnsPerYear}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Days on shelf:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {item.daysOnShelf}
        </div>
      </div>
      <div
        style={getStatusStyle(item.status)}
        className="w-full rounded-lg h-9 flex items-center justify-center text-[15px] font-satoshi font-bold"
      >
        {item.status}
      </div>
    </div>
  );
};

export default InventoryTurnoverCard;
