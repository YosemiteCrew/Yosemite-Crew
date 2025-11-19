"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import InventoryCard from "../Cards/InventoryCard";
import { InventoryItem } from "@/app/pages/Inventory/types";
import { IoEye } from "react-icons/io5";

import "./DataTable.css"

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type InventoryTableProps = {
  filteredList: InventoryItem[];
};

export const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
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

const InventoryTable = ({ filteredList }: InventoryTableProps) => {
  const columns: Column<InventoryItem>[] = [
    {
      label: "Item name",
      key: "name",
      width: "15%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">{item.name}</div>
      ),
    },
    {
      label: "Category",
      key: "category",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">{item.category}</div>
      ),
    },
    {
      label: "On hand",
      key: "on-hand",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {item.onHand + " units"}
        </div>
      ),
    },
    {
      label: "Unit cost",
      key: "unit-cost",
      width: "7.5%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">{"$ " + item.unitCost}</div>
      ),
    },
    {
      label: "Selling price",
      key: "selling-price",
      width: "7.5%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {"$ " + item.sellingPrice}
        </div>
      ),
    },
    {
      label: "Total value",
      key: "total-vale",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">
          {"$ " + item.totalValue}
        </div>
      ),
    },
    {
      label: "Expiry",
      key: "expiry",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">{item.expiry}</div>
      ),
    },
    {
      label: "Location",
      key: "location",
      width: "10%",
      render: (item: InventoryItem) => (
        <div className="appointment-profile-title">{item.location}</div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: InventoryItem) => (
        <div className="appointment-status" style={getStatusStyle(item.status)}>
          {item.status}
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "5%",
      render: (item: InventoryItem) => (
        <div className="action-btn-col">
          <button className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer">
            <IoEye size={20} color="#302F2E" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <div className="hidden xl:flex">
        <GenericTable data={filteredList} columns={columns} bordered={false} pagination pageSize={5} />
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {filteredList.map((item: any) => (
          <InventoryCard key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
};

export default InventoryTable;
