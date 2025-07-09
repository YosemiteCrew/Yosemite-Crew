"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import "./DataTable.css"
import { Button } from "react-bootstrap";
import { FaEye } from "react-icons/fa6";
import { RiDeleteBin5Fill } from "react-icons/ri";

type ProcedureItem = {
  status: "in-stock" | "low-stock";
  name: string;
  category: string;
  item: string;
  cost: string;
  created: string;
  update: string;
};

const data: ProcedureItem[] = [
  {
    status: "in-stock",
    name: "Bitch Spay",
    category: "Surgical Procedures",
    item: "7",
    cost: "USD 450",
    created: "Admin",
    update: "10 Nov 2024",
  },
  {
    status: "low-stock",
    name: "Bitch Spay",
    category: "Surgical Procedures",
    item: "7",
    cost: "USD 450",
    created: "Admin",
    update: "10 Nov 2024",
  },
  {
    status: "in-stock",
    name: "Bitch Spay",
    category: "Surgical Procedures",
    item: "7",
    cost: "USD 450",
    created: "Admin",
    update: "10 Nov 2024",
  },
  {
    status: "in-stock",
    name: "Bitch Spay",
    category: "Surgical Procedures",
    item: "7",
    cost: "USD 450",
    created: "Admin",
    update: "10 Nov 2024",
  },
  {
    status: "low-stock",
    name: "Bitch Spay",
    category: "Surgical Procedures",
    item: "7",
    cost: "USD 450",
    created: "Admin",
    update: "10 Nov 2024",
  },
  {
    status: "in-stock",
    name: "Bitch Spay",
    category: "Surgical Procedures",
    item: "7",
    cost: "USD 450",
    created: "Admin",
    update: "10 Nov 2024",
  },
  {
    status: "low-stock",
    name: "Bitch Spay",
    category: "Surgical Procedures",
    item: "7",
    cost: "USD 450",
    created: "Admin",
    update: "10 Nov 2024",
  },
  {
    status: "in-stock",
    name: "Bitch Spay",
    category: "Surgical Procedures",
    item: "7",
    cost: "USD 450",
    created: "Admin",
    update: "10 Nov 2024",
  },
  {
    status: "low-stock",
    name: "Bitch Spay",
    category: "Surgical Procedures",
    item: "7",
    cost: "USD 450",
    created: "Admin",
    update: "10 Nov 2024",
  },

];

const columns = [


  {
    label: "",
    key: "avatar",
    width: "20px",
    render: (item: ProcedureItem) => (
      <span className={`inv-status-dot ${item.status}`} />
    ),
  },
  {
    label: "Name",
    key: "name",
    // width: "0px",
    render: (item: ProcedureItem) => (
      <div>
        <p>{item.name}</p>
        
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
    render: (item: ProcedureItem) => <p>{item.item}</p>,
  },
  {
    label: "Total Cost",
    key: "cost",
    render: (item: ProcedureItem) => <p>{item.cost}</p>,
  },
  {
    label: "Created by",
    key: "created",
    render: (item: ProcedureItem) => <p>{item.created}</p>,
  },
  {
    label: "Last updated",
    key: "updated",
    render: (item: ProcedureItem) => <p>{item.update}</p>,
  },
  {
    label: "Actions",
    key: "actions",
    width: "60px",
    render: () => (
        <div className="Cardiologybtn">
            <Button> <FaEye size={24}/> </Button>
            <Button className="red"> <RiDeleteBin5Fill size={24}/> </Button>
        </div>
    ),
    },
];


function ProcedurePackagesTable() {
  return (
    <>
    <div className="table-wrapper">
      <GenericTable data={data} columns={columns} bordered={false} />
      
    </div>

    </>
  )
}

export default ProcedurePackagesTable