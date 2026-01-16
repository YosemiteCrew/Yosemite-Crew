"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import { InventoryTurnoverItem } from "@/app/pages/Inventory/types";
import InventoryTurnoverCard from "../Cards/InventoryTurnoverCard";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type InventoryTurnoverTableProps = {
  filteredList: InventoryTurnoverItem[];
};

export const getStatusStyle = (status?: string) => {
  const key = (status || "").toLowerCase();
  switch (key) {
    case "excellent":
      return { color: "#F7F7F7", backgroundColor: "#747283" };
    case "low":
      return { color: "#F7F7F7", backgroundColor: "#D28F9A" };
    case "moderate":
      return { color: "#F7F7F7", backgroundColor: "#BF9FAA" };
    case "out of stock":
      return { color: "#F7F7F7", backgroundColor: "#D28F9A" };
    case "healthy":
      return { color: "#F7F7F7", backgroundColor: "#D9A488" };
    default:
      return { color: "#F7F7F7", backgroundColor: "#A8A181" };
  }
};

export const formatTurnoverStatus = (status?: string) => {
  const label = (status || "").toString().trim();
  if (!label) return "—";
  return label
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const InventoryTurnoverTable = ({
  filteredList,
}: InventoryTurnoverTableProps) => {
  const getAverageInventory = (item: InventoryTurnoverItem) =>
    item.averageInventory ?? item.avgInventory ?? 0;

  const getTotalPurchased = (item: InventoryTurnoverItem) =>
    item.totalPurchases ?? item.totalPurchased ?? 0;

  const columns: Column<InventoryTurnoverItem>[] = [
    {
      label: "Item name",
      key: "name",
      width: "15%",
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.name}</div>
      ),
    },
    {
      label: "Category",
      key: "category",
      width: "10%",
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.category}</div>
      ),
    },
    {
      label: "Beginning inventory",
      key: "Beginning inventory",
      width: "10%",
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">
          {item.beginningInventory}
        </div>
      ),
    },
    {
      label: "Ending inventory",
      key: "Ending inventory",
      width: "10%",
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.endingInventory}</div>
      ),
    },
    {
      label: "Avg inventory",
      key: "Avg inventory",
      width: "10%",
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">
          {getAverageInventory(item)}
        </div>
      ),
    },
    {
      label: "Total purchases",
      key: "Total purchases",
      width: "10%",
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">
          {getTotalPurchased(item)}
        </div>
      ),
    },
    {
      label: "Turns/Year",
      key: "Turns/Year",
      width: "10%",
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.turnsPerYear}</div>
      ),
    },
    {
      label: "Days on shelf",
      key: "Days on shelf",
      width: "10%",
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">{item.daysOnShelf}</div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: InventoryTurnoverItem) => (
        <div
          className="appointment-status"
          style={getStatusStyle(item.status)}
        >
          {formatTurnoverStatus(item.status)}
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
        {filteredList.map((item: any) => (
          <InventoryTurnoverCard key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
};

export default InventoryTurnoverTable;
