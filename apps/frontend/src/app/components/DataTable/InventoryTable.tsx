"use client";
import React from "react";
import { IoEye } from "react-icons/io5";
import GenericTable from "../GenericTable/GenericTable";
import InventoryCard from "../Cards/InventoryCard";
import { InventoryItem } from "@/app/pages/Inventory/types";
import { displayStatusLabel, formatDisplayDate, getStatusBadgeStyle } from "@/app/pages/Inventory/utils";

import "./DataTable.css";

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
};

export const getStatusStyle = (status: string) => {
  return getStatusBadgeStyle(status);
};

const InventoryTable = ({
  filteredList,
  setActiveInventory,
  setViewInventory,
}: InventoryTableProps) => {
  const handleViewInventory = (inventory: InventoryItem) => {
    setActiveInventory(inventory);
    setViewInventory(true);
  };

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

  const totalValue = (item: InventoryItem) => {
    const price = Number(item.pricing.selling ?? 0);
    const onHand = Number(item.stock.current ?? 0);
    if (!Number.isFinite(price) || !Number.isFinite(onHand)) return "—";
    return `$ ${Math.round(price * onHand)}`;
  };

  const columns: Column<InventoryItem>[] = [
    {
      label: "Item name",
      key: "name",
      width: "15%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">{item.basicInfo.name}</div>
      ),
    },
    {
      label: "Category",
      key: "category",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {item.basicInfo.category}
        </div>
      ),
    },
    {
      label: "On hand",
      key: "on-hand",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {displayValue(item.stock.current || "") === "—"
            ? "—"
            : `${item.stock.current} units`}
        </div>
      ),
    },
    {
      label: "Unit cost",
      key: "unit-cost",
      width: "7.5%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {formatCurrency(item.pricing.purchaseCost)}
        </div>
      ),
    },
    {
      label: "Selling price",
      key: "selling-price",
      width: "7.5%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {formatCurrency(item.pricing.selling)}
        </div>
      ),
    },
    {
      label: "Total value",
      key: "total-vale",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {totalValue(item)}
        </div>
      ),
    },
    {
      label: "Expiry",
      key: "expiry",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {formatDisplayDate(item.batch.expiryDate) || "—"}
        </div>
      ),
    },
    {
      label: "Location",
      key: "location",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {displayValue(item.stock.stockLocation)}
        </div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: InventoryItem) => (
        <div
          className="appointment-status"
          style={getStatusStyle(displayStatusLabel(item))}
        >
          {displayStatusLabel(item)}
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "5%",
      render: (item: InventoryItem) => (
        <div className="action-btn-col">
          <button
            onClick={() => handleViewInventory(item)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={20} color="#302F2E" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <div className="hidden xl:flex">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={5}
        />
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {filteredList.map((item: InventoryItem) => (
          <InventoryCard
            key={item.id ?? item.basicInfo.name}
            item={item}
            handleViewInventory={handleViewInventory}
          />
        ))}
      </div>
    </div>
  );
};

export default InventoryTable;
