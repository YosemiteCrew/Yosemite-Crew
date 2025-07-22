"use client";
import React, { useState } from 'react'
import GenericTable from "../GenericTable/GenericTable";
import "./DataTable.css";
import { Button, Dropdown, Form } from "react-bootstrap";
import {  FaRegTrashAlt } from "react-icons/fa";
import { Column } from "../GenericTable/GenericTable";
import {  MdModeEditOutline } from "react-icons/md";
import { LuSearch } from "react-icons/lu";

const Switch = ({ id, checked, onChange }: { id: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => {
  return (
    <Form.Check
      type="switch"
      id={id}
      checked={checked}
      onChange={onChange}
    />
  );
};

type DiscountsItem = {
  toggle: boolean;
  dicountCode: string;
  typename: string;
  typeoff: string;
  createdate: string;
  exprydate: string;
  count: number;
  status: "Paid" | "Unpaid" | "Partially Paid" | "Overdue";
  actions?: string;
};

const discount: DiscountsItem[] = [
  {
    toggle: true,
    dicountCode: "PETFIRST",
    typename: "Percentage",
    typeoff: "10% Off on First Services",
    createdate: "20 Jan 2025",
    exprydate: "20 Mar 2025",
    count: 50,
    status: "Paid",
  },
  {
    toggle: true,
    dicountCode: "SUMMER10",
    typename: "Fixed amount",
    typeoff: "$10 OFF on Grooming Services",
    createdate: "2 Jan 2025",
    exprydate: "2 Jun 2025",
    count: 120,
    status: "Paid",
  },
  {
    toggle: false,
    dicountCode: "VETCARE20",
    typename: "Percentage",
    typeoff: "20% OFF on second Consultation",
    createdate: "31 Jan 2025",
    exprydate: "31 May 2025",
    count: 35,
    status: "Unpaid",
  },
  {
    toggle: true,
    dicountCode: "LOYALTY10",
    typename: "Percentage",
    typeoff: "10% OFF on third Consultation",
    createdate: "28 Jan 2025",
    exprydate: "-",
    count: 201,
    status: "Partially Paid",
  },
  {
    toggle: true,
    dicountCode: "MERRY30",
    typename: "Percentage",
    typeoff: "30% Off on All Services",
    createdate: "22 Dec 2024",
    exprydate: "8 Jan 2025",
    count: 74,
    status: "Overdue",
  },
  {
    toggle: true,
    dicountCode: "SPECIAL25",
    typename: "Percentage",
    typeoff: "25% Off on Grooming Services",
    createdate: "12 Nov 2024",
    exprydate: "12 Feb 2025",
    count: 19,
    status: "Overdue",
  },
  
];



const columns: Column<DiscountsItem>[] = [
  {
    label: "",
    key: "toggle",
    width: "60px",
    render: (item: DiscountsItem, index: number) => (
      <Switch
        id={`switch-${index}`}
        checked={item.toggle}
        onChange={() => console.log("Toggled", item)}
      />
    ),
  },
  {
    label: "Discount Code",
    key: "dicountCode",
    render: (item: DiscountsItem) => <p>{item.dicountCode}</p>,
  },
  {
    label: "Type",
    key: "type",
    render: (item: DiscountsItem) => 
        <div>
            <p>{item.typename}</p>
            <span>{item.typeoff}</span>
        </div>,
  },
  {
    label: "Created On",
    key: "createdate",
    render: (item: DiscountsItem) => <p>{item.createdate}</p>,
  },
  {
    label: "Expiry Date",
    key: "exprydate",
    render: (item: DiscountsItem) => <p>{item.exprydate}</p>,
  },
  {
    label: "Usage Count",
    key: "count",
    render: (item: DiscountsItem) => <p>{item.count}</p>,
  },
  {
    label: "Status",
    key: "status",
    render: (item: DiscountsItem) => (
      <div className={`statusbadgebtn ${item.status.toLowerCase().replace(/ /g, "-")}`}>
        {item.status}
      </div>
    ),
  },
  {
    label: "Actions",
    key: "actions",
    width: "100px",
    render: () => (
      <div className="Procedaction-buttons">
        <Button variant="link" className="action-btn">
          <MdModeEditOutline size={20} />
        </Button>
        <Button variant="link" className="action-btn">
          <FaRegTrashAlt size={20} />
        </Button>
      </div>
    ),
  },
];

function ManageDiscountTable() {

    const [selectedStatus, setSelectedStatus] = useState("Coupon Type");
    const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("Status");
    const [search, setSearch] = useState("");
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Implement search logic here
        alert(`Searching for: ${search}`);
    };
    


  return (
    <>

    <div className="TableDropdownWrapper">


        <div className="RightTopTbl">
            <Form className="Tblserchdiv" onSubmit={handleSearch} >
                <input
                type="search"
                placeholder="Code Name"
                value={search}
                onChange={e => setSearch(e.target.value)}
                />
                <Button type="submit"><LuSearch size={20} /></Button>
            </Form>
            <div className="StatusSlect">
                <Dropdown onSelect={val => setSelectedStatus(val || "Amount")}>
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
                <Dropdown onSelect={val => setSelectedPaymentStatus(val || "Payment Status")}>
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

        <div className="table-wrapper">
            <GenericTable data={discount} columns={columns} bordered={false} pagination pageSize={6} />
        </div>
    </div>

    </>
  )
}

export default ManageDiscountTable