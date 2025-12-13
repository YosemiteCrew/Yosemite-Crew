import React from "react";
import { getStatusStyle } from "../../DataTable/InventoryTable";
import { displayStatusLabel } from "@/app/pages/Inventory/utils";
import { formatDisplayDate } from "@/app/pages/Inventory/utils";

const InventoryCard = ({ item, handleViewInventory }: any) => {
  const formatCurrency = (value: string | number | undefined) => {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return "$ 0";
    return `$ ${num}`;
  };

  const totalValue = () => {
    const price = Number(item.pricing?.selling ?? 0);
    const onHand = Number(item.stock?.current ?? 0);
    if (!Number.isFinite(price) || !Number.isFinite(onHand)) return "$ 0";
    return `$ ${Math.round(price * onHand)}`;
  };

  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-[23px] font-satoshi font-bold text-black-text">
          {item.basicInfo.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Category:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {item.basicInfo.category}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Stock:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {(item.stock.current || 0) + " units"}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Unit cost:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {formatCurrency(item.pricing.purchaseCost)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Selling price:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {formatCurrency(item.pricing.selling)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Total value:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {totalValue()}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Expiry:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {formatDisplayDate(item.batch.expiryDate)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Location:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {item.stock.stockLocation}
        </div>
      </div>
      <div
        style={getStatusStyle(displayStatusLabel(item))}
        className="w-full rounded-lg h-9 flex items-center justify-center text-[15px] font-satoshi font-bold"
      >
        {displayStatusLabel(item)}
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={() => handleViewInventory(item)}
          className="w-full border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer"
        >
          View
        </button>
      </div>
    </div>
  );
};

export default InventoryCard;
