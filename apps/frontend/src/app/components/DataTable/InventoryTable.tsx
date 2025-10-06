"use client";
import React from "react";
import { BsFillBoxSeamFill } from "react-icons/bs";
import { Button } from "react-bootstrap";

import GenericTable from "@/app/components/GenericTable/GenericTable";

import "./DataTable.css";

type InventoryItem = {
  status: "in-stock" | "low-stock";
  itemName: string;
  genericName: string;
  sku: string;
  strength: string;
  category: string;
  manufacturer: string;
  price: string;
  manufacturerPrice: string;
  stockReorderLevel: number;
  quantity: number;
  expiryDate: string;
};

const columns = [
  {
    label: "",
    key: "avatar",
    width: "20px",
    render: (item: InventoryItem) => (
      <span className={`inv-status-dot ${item.status}`} />
    ),
  },
  {
    label: "Name",
    key: "name",
    // width: "0px",
    render: (item: InventoryItem) => (
      <div>
        <p>{item.itemName}</p>
      </div>
    ),
  },
  {
    label: "Generic Name",
    key: "genericName",
    render: (item: InventoryItem) => <p>{item.genericName}</p>,
  },
  {
    label: "SKU",
    key: "sku",
    render: (item: InventoryItem) => <p>{item.sku}</p>,
  },
  // {
  //   label: "Strength",
  //   key: "strength",
  //   render: (item: InventoryItem) => <p>{item.strength}</p>,
  // },
  {
    label: "Category",
    key: "category",
    render: (item: InventoryItem) => <p>{item.category}</p>,
  },
  {
    label: "Manufacturer",
    key: "manufacturer",
    render: (item: InventoryItem) => <p>{item.manufacturer}</p>,
  },
  {
    label: "Price",
    key: "price",
    render: (item: InventoryItem) => <p>{item.price}</p>,
  },
  {
    label: "Manufacturer Price",
    key: "manufacturerPrice",
    render: (item: InventoryItem) => <p>{item.manufacturerPrice}</p>,
  },
  {
    label: "Stock",
    key: "stock",
    render: (item: InventoryItem) => (
      <div>
        <p>{item.stockReorderLevel}</p>
        <span>
          <BsFillBoxSeamFill /> {item.quantity}
        </span>
      </div>
    ),
  },
  {
    label: "Expiry Date",
    key: "expiry",
    render: (item: InventoryItem) => <p>{item.expiryDate}</p>,
  },
];

const InventoryTable = ({ data }: any) => {
  console.log("InventoryTable data:", data);
  return (
    <div className="table-wrapper">
      <GenericTable data={data} columns={columns} bordered={false} />
      <div className="table-footerBtn ">
        <Button>Sell All</Button>
      </div>
    </div>
  );
};

export default InventoryTable;
