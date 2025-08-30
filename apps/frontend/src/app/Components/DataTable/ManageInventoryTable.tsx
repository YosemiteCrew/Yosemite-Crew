"use client";
import React, { useState } from "react";
import GenericTable from "../GenericTable/GenericTable";
import { BsFillBoxSeamFill } from "react-icons/bs";
import "./DataTable.css"
import { Button, Dropdown, Form } from "react-bootstrap";
import { FaEye } from "react-icons/fa6";
import { Icon } from "@iconify/react/dist/iconify.js";

type ManageInventryItem = {
  status: "in-stock" | "low-stock";
  itemName: string;
  genericName: string;
  sku: string;
  strength: string;
  category: string;
  species: string;
  department: string;
  sexType: string;
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
    render: (item: ManageInventryItem) => <p className="text-ellipsis">{item.category}</p>,
  },
  {
    label: "Species/Sex",
    key: "species",
    render: (item: ManageInventryItem) => <p>{item.sexType}</p>,
  },
  {
    label: "Department",
    key: "department",
    render: (item: ManageInventryItem) => <p>{item.department}</p>,
  },
  {
    label: "Manufacturer",
    key: "manufacturer",
    render: (item: ManageInventryItem) => <p className="text-ellipsis">{item.manufacturer}</p>,
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
        <span><Icon icon="solar:box-bold" width="20" height="20" /> {item.quantity}</span>
      </div>
    ),
  },
  {
    label: "Price",
    key: "price",
    render: (item: ManageInventryItem) => <p>{item.price}</p>,
  },
  
  {
    label: "Expiry Date",
    key: "expiry",
    render: (item: ManageInventryItem) => <p className="text-ellipsis">{item.expiryDate}</p>,
  },
  {
    label: "Actions",
    key: "actions",
    width: "60px",
    render: () => (
        <div className="action-btn-col displx">
            <Button className="circle-btn view"> <Icon icon="solar:eye-bold" width="20" height="20" /> </Button>
        </div>
    ),
    },
];

function ManageInventoryTable({data}:any) {


  const [selectedStatus, setSelectedStatus] = useState("Stock");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("Expiry Date");
  const [selectedItemStatus, setSelectedItemStatus] = useState("Items 10");
  const [search, setSearch] = useState("");
  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      // Implement search logic here
      alert(`Searching for: ${search}`);
  };
  



  return (

    <>
    <div className="TableDropdownWrapper">

      <div className="InventroyDashtabl">
        <div className="RightTopTbl">
          <Form className="Tblserchdiv" onSubmit={handleSearch} >
              <input
              type="search"
              placeholder="Search anything"
              value={search}
              onChange={e => setSearch(e.target.value)}
              />
              <Button type="submit"><Icon icon="carbon:search" width="20" height="20" /></Button>
          </Form>
          <div className="StatusSlect">
              <Dropdown onSelect={val => setSelectedStatus(val || "Stock")}>
              <Dropdown.Toggle id="status-dropdown" >
                  {selectedStatus}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                  <Dropdown.Item eventKey="Status">Status</Dropdown.Item>
                  <Dropdown.Item eventKey="Pending">Pending</Dropdown.Item>
                  <Dropdown.Item eventKey="Completed">Completed</Dropdown.Item>
                  <Dropdown.Item eventKey="Cancelled">Cancelled</Dropdown.Item>
              </Dropdown.Menu>
              </Dropdown>
          </div>
          <div className="StatusSlect">
              <Dropdown onSelect={val => setSelectedPaymentStatus(val || "Expiry Date")}>
              <Dropdown.Toggle id="status-dropdown" >
                  {selectedPaymentStatus}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                  <Dropdown.Item eventKey="Status">Status</Dropdown.Item>
                  <Dropdown.Item eventKey="Pending">Pending</Dropdown.Item>
                  <Dropdown.Item eventKey="Completed">Completed</Dropdown.Item>
                  <Dropdown.Item eventKey="Cancelled">Cancelled</Dropdown.Item>
              </Dropdown.Menu>
              </Dropdown>
          </div>
        </div>

        <div className="StatusSlect">
            <Dropdown onSelect={val => setSelectedItemStatus(val || "Items 10")}>
            <Dropdown.Toggle id="status-dropdown" >
                {selectedItemStatus}
            </Dropdown.Toggle>
            <Dropdown.Menu>
                <Dropdown.Item eventKey="Items 10">Items 10</Dropdown.Item>
                <Dropdown.Item eventKey="Items 20">Items 20</Dropdown.Item>
                <Dropdown.Item eventKey="Items 30">Items 30</Dropdown.Item>
                <Dropdown.Item eventKey="Items 50">Items 50</Dropdown.Item>
            </Dropdown.Menu>
            </Dropdown>
        </div>
      </div>
      
      <div className="table-wrapper">
        <GenericTable data={data} columns={columns} bordered={false} pagination pageSize={6} />
      </div>

     </div>

    </>
  )
}

export default ManageInventoryTable