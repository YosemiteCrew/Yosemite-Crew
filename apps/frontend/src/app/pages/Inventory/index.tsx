"use client";
import React, { useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Primary } from "@/app/components/Buttons";
import InventoryFilters from "@/app/components/Filters/InventoryFilters";
import InventoryTable from "@/app/components/DataTable/InventoryTable";
import { DemoInventoryTurnover, InventoryData, InventoryItem, InventoryTurnoverItem } from "./types";
import AddInventory from "@/app/components/AddInventory";
import InventoryTurnoverFilters from "@/app/components/Filters/InventoryTurnoverFilters";
import InventoryTurnoverTable from "@/app/components/DataTable/InventoryTurnoverTable";

const Inventory = () => {
  const [list] = useState<InventoryItem[]>(InventoryData);
  const [filteredList, setFilteredList] =
    useState<InventoryItem[]>(InventoryData);
  const [addPopup, setAddPopup] = useState(false);
  const [turnoverList] = useState<InventoryTurnoverItem[]>(DemoInventoryTurnover);
  const [filteredTurnoverList, setFilteredTurnoverList] = useState<InventoryTurnoverItem[]>(DemoInventoryTurnover);

  return (
    <div className="flex flex-col gap-8 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="flex justify-between items-center w-full">
        <div className="font-grotesk font-medium text-black-text text-[33px]">
          Inventory
        </div>
        <Primary
          href="#"
          text="Add"
          onClick={() => setAddPopup(true)}
          classname="w-[140px] sm:w-40"
        />
      </div>
      <div className="w-full flex flex-col gap-6">
        <InventoryFilters list={list} setFilteredList={setFilteredList} />
        <InventoryTable filteredList={filteredList} />
      </div>
      <div className="w-full flex flex-col gap-6">
        <InventoryTurnoverFilters
          list={turnoverList}
          setFilteredList={setFilteredTurnoverList}
        />
        <InventoryTurnoverTable filteredList={filteredTurnoverList} />
      </div>
      <AddInventory showModal={addPopup} setShowModal={setAddPopup} />
    </div>
  );
};

const ProtectedInventory = () => {
  return (
    <ProtectedRoute>
      <Inventory />
    </ProtectedRoute>
  );
};

export default ProtectedInventory;
