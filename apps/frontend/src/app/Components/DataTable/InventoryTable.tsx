"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import { BsFillBoxSeamFill } from "react-icons/bs";
import "./DataTable.css"
import { Button } from "react-bootstrap";

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
  stockSub: number;
  expiryDate: string;
};

// const data: InventoryItem[] = [
//   {
//     status: "in-stock",
//     itemName: "Zimax",
//     genericName: "Azithromycin",
//     sku: "UY3750",
//     strength: "500mg",
//     category: "Tablet",
//     manufacturer: "Zoetis",
//     price: "USD 20.55",
//     manufacturerPrice: "USD 15.00",
//     stockReorderLevel: 20,
//     stockSub: 150,
//     expiry: "19/12/2024",
//   },
//   {
//     status: "in-stock",
//     itemName: "Oxidon",
//     genericName: "Domperidon",
//     sku: "UY3749",
//     strength: "10mg",
//     category: "Tablet",
//     manufacturer: "Intas",
//     price: "USD 15.00",
//     manufacturerPrice: "USD 12.00",
//     stockReorderLevel: 13,
//     stockSub: 60,
//     expiry: "17/05/2025",
//   },
//   {
//     status: "low-stock",
//     itemName: "Ceevit",
//     genericName: "Multivitamin",
//     sku: "UY3710",
//     strength: "250mg",
//     category: "Vitamins",
//     manufacturer: "Boehringer In...",
//     price: "USD 12.45",
//     manufacturerPrice: "USD 10.00",
//     stockReorderLevel: 5,
//     stockSub: 45,
//     expiry: "19/12/2024",
//   },
//   {
//     status: "in-stock",
//     itemName: "DON A",
//     genericName: "Domperidon",
//     sku: "UY3798",
//     strength: "10mg",
//     category: "Tablet",
//     manufacturer: "Virbac",
//     price: "USD 50.00",
//     manufacturerPrice: "USD 40.00",
//     stockReorderLevel: 11,
//     stockSub: 55,
//     expiry: "08/07/2026",
//   },
//   {
//     status: "in-stock",
//     itemName: "Pantorix",
//     genericName: "Pantoprazol",
//     sku: "UY3760",
//     strength: "20mg",
//     category: "Tablet",
//     manufacturer: "Boehringer In...",
//     price: "USD 10.45",
//     manufacturerPrice: "USD 8.00",
//     stockReorderLevel: 27,
//     stockSub: 100,
//     expiry: "14/01/2026",
//   },
//   {
//     status: "low-stock",
//     itemName: "Isoniazid",
//     genericName: "Hydrazine",
//     sku: "UY3740",
//     strength: "1.5ml",
//     category: "Syrup",
//     manufacturer: "Boehringer In...",
//     price: "USD 25.85",
//     manufacturerPrice: "USD 17.25",
//     stockReorderLevel: 4,
//     stockSub: 48,
//     expiry: "07/03/2025",
//   },
// ];

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
  {
    label: "Strength",
    key: "strength",
    render: (item: InventoryItem) => <p>{item.strength}</p>,
  },
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
        <span><BsFillBoxSeamFill /> {item.stockSub}</span>
      </div>
    ),
  },
  {
    label: "Expiry Date",
    key: "expiry",
    render: (item: InventoryItem) => <p>{item.expiryDate}</p>,
  },
];

function InventoryTable({data}:any) {
  return (
    <div className="table-wrapper">
      <GenericTable data={data} columns={columns} bordered={false} />
      <div className="table-footerBtn ">
        <Button>Sell All</Button>
      </div>
    </div>
  );
}

export default InventoryTable;