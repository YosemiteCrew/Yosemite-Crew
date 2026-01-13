import React from "react";
import { getStatusStyle } from "../../DataTable/InventoryTable";
import {
  displayStatusLabel,
  formatDisplayDate,
} from "@/app/pages/Inventory/utils";
import { Secondary } from "../../Buttons";

const InventoryCard = ({ item, handleViewInventory }: any) => {
  const displayValue = (val?: string | number | null) => {
    if (val === undefined || val === null) return "—";
    if (typeof val === "string" && val.trim() === "") return "—";
    return val;
  };

  const formatCurrency = (value: string | number | undefined) => {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return "—";
    return `$ ${num}`;
  };

  const totalValue = () => {
    const price = Number(item.pricing?.selling ?? 0);
    const onHand = Number(item.stock?.current ?? 0);
    if (!Number.isFinite(price) || !Number.isFinite(onHand)) return "—";
    return `$ ${Math.round(price * onHand)}`;
  };

  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">
          {item.basicInfo.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Category:</div>
        <div className="text-caption-1 text-text-primary">
          {item.basicInfo.category}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Stock:</div>
        <div className="text-caption-1 text-text-primary">
          {displayValue(item.stock.current || "") === "—"
            ? "—"
            : `${item.stock.current} units`}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Unit cost:</div>
        <div className="text-caption-1 text-text-primary">
          {formatCurrency(item.pricing.purchaseCost)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Selling price:</div>
        <div className="text-caption-1 text-text-primary">
          {formatCurrency(item.pricing.selling)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Total value:</div>
        <div className="text-caption-1 text-text-primary">{totalValue()}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Expiry:</div>
        <div className="text-caption-1 text-text-primary">
          {formatDisplayDate(item.batch.expiryDate) || "—"}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Location:</div>
        <div className="text-caption-1 text-text-primary">
          {displayValue(item.stock.stockLocation)}
        </div>
      </div>
      <div
        style={getStatusStyle(displayStatusLabel(item))}
        className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
      >
        {displayStatusLabel(item)}
      </div>
      <div className="flex gap-3 w-full">
        <Secondary
          href="#"
          onClick={() => handleViewInventory(item)}
          text="View"
          className="w-full"
        />
      </div>
    </div>
  );
};

export default InventoryCard;
