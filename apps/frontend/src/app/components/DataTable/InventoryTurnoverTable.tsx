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

export const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case "excellent":
      return { color: "#54B492", backgroundColor: "#E6F4EF" };
    case "low":
      return { color: "#EA3729", backgroundColor: "#FDEBEA" };
    case "moderate":
      return { color: "#F68523", backgroundColor: "#FEF3E9" };
    case "out of stock":
      return { color: "#302f2e", backgroundColor: "#eaeaea" };
    case "healthy":
      return { color: "#247AED", backgroundColor: "#EAF3FF" };
    default:
      return { color: "#6b7280", backgroundColor: "rgba(107,114,128,0.1)" };
  }
};

const InventoryTurnoverTable = ({
  filteredList,
}: InventoryTurnoverTableProps) => {
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
        <div className="appointment-profile-title">{item.averageInventory}</div>
      ),
    },
    {
      label: "Total purchases",
      key: "Total purchases",
      width: "10%",
      render: (item: InventoryTurnoverItem) => (
        <div className="appointment-profile-title">
          {"$ " + item.totalPurchases}
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
        <div className="appointment-status" style={getStatusStyle(item.status)}>
          {item.status}
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
