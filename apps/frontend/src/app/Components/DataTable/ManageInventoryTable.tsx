"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import { BsFillBoxSeamFill } from "react-icons/bs";
import "./DataTable.css"
import { Button } from "react-bootstrap";
import { FaEye } from "react-icons/fa6";

type ManageInventryItem = {
  status: "in-stock" | "low-stock";
  itemName: string;
  genericName: string;
  sku: string;
  strength: string;
  category: string;
  manufacturer: string;
  price: string;
  manufacturerPrice: string;
  stock: number;
  quantity: number;
  expiryDate: string;
};


const columns = [


  {
    label: "",
    key: "avatar",
    width: "20px",
    render: (item: ManageInventryItem) => (
      <span className={`inv-status-dot ${item.status}`} />
    ),
  },
  {
    label: "Name",
    key: "name",
    // width: "0px",
    render: (item: ManageInventryItem) => (
      <div>
        <p>{item.itemName}</p>
        
      </div>
    ),
  },
  {
    label: "Generic Name",
    key: "genericName",
    render: (item: ManageInventryItem) => <p>{item.genericName}</p>,
  },
  {
    label: "SKU",
    key: "sku",
    render: (item: ManageInventryItem) => <p>{item.sku}</p>,
  },
  {
    label: "Strength",
    key: "strength",
    render: (item: ManageInventryItem) => <p>{item.strength}</p>,
  },
  {
    label: "Category",
    key: "category",
    render: (item: ManageInventryItem) => <p>{item.category}</p>,
  },
  {
    label: "Manufacturer",
    key: "manufacturer",
    render: (item: ManageInventryItem) => <p>{item.manufacturer}</p>,
  },
  {
    label: "Price",
    key: "price",
    render: (item: ManageInventryItem) => <p>{item.price}</p>,
  },
  {
    label: "Manufacturer Price",
    key: "manufacturerPrice",
    render: (item: ManageInventryItem) => <p>{item.manufacturerPrice}</p>,
  },
  {
    label: "Stock",
    key: "stock",
    render: (item: ManageInventryItem) => (
      <div>
        <p>{item.stock}</p>
        <span><BsFillBoxSeamFill /> {item.quantity}</span>
      </div>
    ),
  },
  {
    label: "Expiry Date",
    key: "expiry",
    render: (item: ManageInventryItem) => <p>{item.expiryDate}</p>,
  },
  {
    label: "Actions",
    key: "actions",
    width: "60px",
    render: () => (
        <div className="Cardiologybtn">
            <Button> <FaEye size={24}/> </Button>
        </div>
    ),
    },
];

function ManageInventoryTable({data}:any) {
  return (
    <>
    <div className="d"></div>
    <div className="table-wrapper">
      <GenericTable data={data} columns={columns} bordered={false} pagination pageSize={6} />
      
    </div>

    </>
  )
}

export default ManageInventoryTable