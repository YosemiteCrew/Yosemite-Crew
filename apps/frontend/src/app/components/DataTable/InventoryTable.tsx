"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import InventoryCard from "../Cards/InventoryCard";
import { InventoryItem } from "@/app/pages/Inventory/types";
import { IoEye } from "react-icons/io5";

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
  switch (status?.toLowerCase()) {
    case "this week":
      return { color: "#54B492", backgroundColor: "#E6F4EF" };
    case "expired":
      return { color: "#EA3729", backgroundColor: "#FDEBEA" };
    case "low stock":
      return { color: "#F68523", backgroundColor: "#FEF3E9" };
    case "hidden":
      return { color: "#302f2e", backgroundColor: "#eaeaea" };
    default:
      return { color: "#6b7280", backgroundColor: "rgba(107,114,128,0.1)" };
  }
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
          {item.stock.current + " units"}
        </div>
      ),
    },
    {
      label: "Unit cost",
      key: "unit-cost",
      width: "7.5%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {"$ " + item.pricing.purchaseCost}
        </div>
      ),
    },
    {
      label: "Selling price",
      key: "selling-price",
      width: "7.5%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {"$ " + item.pricing.selling}
        </div>
      ),
    },
    {
      label: "Total value",
      key: "total-vale",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {"$ " + Number(item.pricing.selling) * Number(item.pricing.selling)}
        </div>
      ),
    },
    {
      label: "Expiry",
      key: "expiry",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">{item.batch.expiryDate}</div>
      ),
    },
    {
      label: "Location",
      key: "location",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {item.stock.stockLocation}
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
          style={getStatusStyle(item.basicInfo.status)}
        >
          {item.basicInfo.status}
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
            key={item.basicInfo.name}
            item={item}
            handleViewInventory={handleViewInventory}
          />
        ))}
      </div>
    </div>
  );
};

export default InventoryTable;
