"use client";
import React, { useState } from 'react'
import "./DataTable.css";
import { Button, Dropdown, Form } from 'react-bootstrap';
import { MdModeEditOutline } from 'react-icons/md';
import { FaRegTrashAlt } from 'react-icons/fa';
import GenericTable from '../GenericTable/GenericTable';
import { LuSearch } from 'react-icons/lu';
import Image from 'next/image';



type ManageBillingItem = {

    Invoice: string;
    name: string;
    petname: string;
    client: string;
    billdate: string;
    amount: string;
    discount: string;
    texed: string;
    outstand: string;
    status: "Paid" | "Unpaid" | "Partially Paid" | "Overdue";
    actions?: string;





};

const estimates: ManageBillingItem[] = [

  {
    Invoice: "3ZTABC456",
    name: "Sky B",
    petname: "Kizie",
    client: "70M6VJN",
    billdate: "6 Jan 2025",
    amount: "$167.77",
    discount: "13.25",
    texed: "$2.99",
    status: "Paid",
    outstand: "-"
  },
  {
    Invoice: "3ZTABC456",
    name: "Sky B",
    petname: "Kizie",
    client: "70M6VJN",
    billdate: "6 Jan 2025",
    amount: "$167.77",
    discount: "13.25",
    texed: "$2.99",
    status: "Unpaid",
    outstand: "-"
  },
  {
    Invoice: "3ZTABC456",
    name: "Sky B",
    petname: "Kizie",
    client: "70M6VJN",
    billdate: "6 Jan 2025",
    amount: "$167.77",
    discount: "13.25",
    texed: "$2.99",
    status: "Paid",
    outstand: "-"
  },
  {
    Invoice: "3ZTABC456",
    name: "Sky B",
    petname: "Kizie",
    client: "70M6VJN",
    billdate: "6 Jan 2025",
    amount: "$167.77",
    discount: "13.25",
    texed: "$2.99",
    status: "Paid",
    outstand: "-"
  },
  {
    Invoice: "3ZTABC456",
    name: "Sky B",
    petname: "Kizie",
    client: "70M6VJN",
    billdate: "6 Jan 2025",
    amount: "$167.77",
    discount: "13.25",
    texed: "$2.99",
    status: "Partially Paid",
    outstand: "-"
  },
  {
    Invoice: "3ZTABC456",
    name: "Sky B",
    petname: "Kizie",
    client: "70M6VJN",
    billdate: "6 Jan 2025",
    amount: "$167.77",
    discount: "13.25",
    texed: "$2.99",
    status: "Overdue",
    outstand: "-"
  },
  {
    Invoice: "3ZTABC456",
    name: "Sky B",
    petname: "Kizie",
    client: "70M6VJN",
    billdate: "6 Jan 2025",
    amount: "$167.77",
    discount: "13.25",
    texed: "$2.99",
    status: "Paid",
    outstand: "-"
  },
  {
    Invoice: "3ZTABC456",
    name: "Sky B",
    petname: "Kizie",
    client: "70M6VJN",
    billdate: "6 Jan 2025",
    amount: "$167.77",
    discount: "13.25",
    texed: "$2.99",
    status: "Overdue",
    outstand: "-"
  },
  {
    Invoice: "3ZTABC456",
    name: "Sky B",
    petname: "Kizie",
    client: "70M6VJN",
    billdate: "6 Jan 2025",
    amount: "$167.77",
    discount: "13.25",
    texed: "$2.99",
    status: "Paid",
    outstand: "-"
  },
  {
    Invoice: "3ZTABC456",
    name: "Sky B",
    petname: "Kizie",
    client: "70M6VJN",
    billdate: "6 Jan 2025",
    amount: "$167.77",
    discount: "13.25",
    texed: "$2.99",
    status: "Paid",
    outstand: "-"
  },
  {
    Invoice: "3ZTABC456",
    name: "Sky B",
    petname: "Kizie",
    client: "70M6VJN",
    billdate: "6 Jan 2025",
    amount: "$167.77",
    discount: "13.25",
    texed: "$2.99",
    status: "Paid",
    outstand: "-"
  },





];



type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render: (item: T) => React.ReactNode;
};

const columns: Column<ManageBillingItem>[] = [

  {
    label: "Invoice #",
    key: "invoice",
    render: (item: ManageBillingItem) => <p>{item.Invoice}</p>,
  },
  {
    label: "Name",
    key: "name",
    render: (item: ManageBillingItem) => 
    <div>
        <p>{item.name}</p>
        <span className="owner"><Image aria-hidden src="/Images/paws.png" alt="paws" width={14} height={14} /> {item.petname}</span>
    </div>,
  },
  {
    label: "Client ID",
    key: "client",
    render: (item: ManageBillingItem) => <p>{item.client}</p>,
  },
  {
    label: "Bill Date",
    key: "bildate",
    render: (item: ManageBillingItem) => <p>{item.billdate}</p>,
  },
  {
    label: "Total Amount",
    key: "amount",
    render: (item: ManageBillingItem) => <p>{item.amount}</p>,
  },
  {
    label: "Discount",
    key: "discount",
    render: (item: ManageBillingItem) => <p>{item.discount}</p>,
  },
  {
    label: "Tax Applied",
    key: "texed",
    render: (item: ManageBillingItem) => <p>{item.texed}</p>,
  },
  {
    label: "Status",
    key: "status",
    render: (item: ManageBillingItem) => (
      <div className={`statusbadgebtn ${item.status.toLowerCase().replace(/ /g, "-")}`}>
        {item.status}
      </div>
    ),
  },
  {
    label: "Amt. Outstanding",
    key: "outstand",
    render: (item: ManageBillingItem) => <p>{item.outstand}</p>,
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


function ManageBillingTable() {

    const [selectedStatus, setSelectedStatus] = useState("Amount");
    const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("Payment Status");
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
                placeholder="Search anything"
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
            <GenericTable data={estimates} columns={columns} bordered={false} pagination pageSize={6} />
        </div>
    </div>





    </>
  )
}

export default ManageBillingTable