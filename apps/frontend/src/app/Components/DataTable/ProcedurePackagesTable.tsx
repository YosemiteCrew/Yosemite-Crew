"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import "./DataTable.css";
import { Button } from "react-bootstrap";
import { FaEye } from "react-icons/fa6";
import { RiDeleteBin5Fill } from "react-icons/ri";
import { ProcedurePackageJSON } from "@yosemite-crew/types";

type ProcedureItem = {
  status: "in-stock" | "low-stock";
  packageName: string;
  category: string;
  packageItems: [];
  cost: string;
  creatorName: string;
  updatedAt: string;
};
function calculateTotalPrice(items: any[]): number {
  // console.log(items," Items in calculateTotalPrice");
  return items.reduce((total, item) => {
    // const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    // console.log("Item:", item, "Qty:", qty, "Unit Price:", unitPrice);
    return total +  unitPrice;
  }, 0);
}
// const data: ProcedureItem[] = [
//   {
//     status: "in-stock",
//     name: "Bitch Spay",
//     category: "Surgical Procedures",
//     item: "7",
//     cost: "USD 450",
//     created: "Admin",
//     update: "10 Nov 2024",
//   },
//   {
//     status: "low-stock",
//     name: "Bitch Spay",
//     category: "Surgical Procedures",
//     item: "7",
//     cost: "USD 450",
//     created: "Admin",
//     update: "10 Nov 2024",
//   },
//   {
//     status: "in-stock",
//     name: "Bitch Spay",
//     category: "Surgical Procedures",
//     item: "7",
//     cost: "USD 450",
//     created: "Admin",
//     update: "10 Nov 2024",
//   },
//   {
//     status: "in-stock",
//     name: "Bitch Spay",
//     category: "Surgical Procedures",
//     item: "7",
//     cost: "USD 450",
//     created: "Admin",
//     update: "10 Nov 2024",
//   },
//   {
//     status: "low-stock",
//     name: "Bitch Spay",
//     category: "Surgical Procedures",
//     item: "7",
//     cost: "USD 450",
//     created: "Admin",
//     update: "10 Nov 2024",
//   },
//   {
//     status: "in-stock",
//     name: "Bitch Spay",
//     category: "Surgical Procedures",
//     item: "7",
//     cost: "USD 450",
//     created: "Admin",
//     update: "10 Nov 2024",
//   },
//   {
//     status: "low-stock",
//     name: "Bitch Spay",
//     category: "Surgical Procedures",
//     item: "7",
//     cost: "USD 450",
//     created: "Admin",
//     update: "10 Nov 2024",
//   },
//   {
//     status: "in-stock",
//     name: "Bitch Spay",
//     category: "Surgical Procedures",
//     item: "7",
//     cost: "USD 450",
//     created: "Admin",
//     update: "10 Nov 2024",
//   },
//   {
//     status: "low-stock",
//     name: "Bitch Spay",
//     category: "Surgical Procedures",
//     item: "7",
//     cost: "USD 450",
//     created: "Admin",
//     update: "10 Nov 2024",
//   },

// ];

const columns = [
  {
    label: "",
    key: "avatar",
    width: "20px",
    render: (item: ProcedureItem) => (
      <span className={`inv-status-dot ${item.packageName}`} />
    ),
  },
  {
    label: "Name",
    key: "packageName",
    // width: "0px",
    render: (item: ProcedureItem) => (
      <div>
        <p>{item.packageName}</p>
      </div>
    ),
  },
  {
    label: "Category",
    key: "category",
    render: (item: ProcedureItem) => <p>{item.category}</p>,
  },

  {
    label: "Items",
    key: "items",
    render: (item: ProcedureItem) => <p>{item.packageItems.length}</p>,
  },
  {
    label: "Total Cost",
    key: "cost",
    render: (item: ProcedureItem) => <p>{calculateTotalPrice(item.packageItems)}</p>,
  },
  {
    label: "Created by",
    key: "created",
    render: (item: ProcedureItem) => <p>{item.creatorName}</p>,
  },
  {
    label: "Last updated",
    key: "updated",
    render: (item: ProcedureItem) => <p>{item.updatedAt}</p>,
  },
  {
    label: "Actions",
    key: "actions",
    width: "60px",
    render: () => (
      <div className="Cardiologybtn">
        <Button>
          {" "}
          <FaEye size={24} />{" "}
        </Button>
        <Button className="red">
          {" "}
          <RiDeleteBin5Fill size={24} />{" "}
        </Button>
      </div>
    ),
  },
];

function ProcedurePackagesTable(data: ProcedurePackageJSON[] | any) {
  // console.log(data.data,"Procedure Package Data in Table")
  return (
    <>
      <div className="table-wrapper">
        <GenericTable data={data.data} columns={columns} bordered={false} />
      </div>
    </>
  );
}

export default ProcedurePackagesTable;
