"use client";
import React, { useState } from 'react'
import "./DataTable.css";
import { Button, Dropdown, Form } from 'react-bootstrap';
import GenericTable from '../GenericTable/GenericTable';
import { LuSearch } from 'react-icons/lu';
import Image from 'next/image';
import { Icon } from '@iconify/react/dist/iconify.js';
import { OverviewDisp } from '@/app/Pages/Departments/DepartmentsDashboard';




type ClientStatementsItem = {

    client: string;
    name: string;
    petname: string;
    statement: string;
    statementdate: string;
    amount: string;
    amountpaid: string;
    Balance: string;
    status: "Paid" | "Unpaid" | "Partially Paid" | "Overdue";
    actions?: string;





};

const estimates: ClientStatementsItem[] = [

  {
    client: "70M6VJN",
    name: "Sky B",
    petname: "Kizie",
    statement: "3ZTABC456",
    statementdate: "6 Jan 2025",
    amount: "$167.77",
    amountpaid: "13.25",
    Balance: "$2.99",
    status: "Paid",
  },
  {
    client: "70M6VJN",
    name: "Sky B",
    petname: "Kizie",
    statement: "3ZTABC456",
    statementdate: "6 Jan 2025",
    amount: "$167.77",
    amountpaid: "13.25",
    Balance: "$2.99",
    status: "Paid",
  },
  {
    client: "70M6VJN",
    name: "Sky B",
    petname: "Kizie",
    statement: "3ZTABC456",
    statementdate: "6 Jan 2025",
    amount: "$167.77",
    amountpaid: "13.25",
    Balance: "$2.99",
    status: "Paid",
  },
  {
    client: "70M6VJN",
    name: "Sky B",
    petname: "Kizie",
    statement: "3ZTABC456",
    statementdate: "6 Jan 2025",
    amount: "$167.77",
    amountpaid: "13.25",
    Balance: "$2.99",
    status: "Unpaid",
  },
  {
    client: "70M6VJN",
    name: "Sky B",
    petname: "Kizie",
    statement: "3ZTABC456",
    statementdate: "6 Jan 2025",
    amount: "$167.77",
    amountpaid: "13.25",
    Balance: "$2.99",
    status: "Paid",
  },
  {
    client: "70M6VJN",
    name: "Sky B",
    petname: "Kizie",
    statement: "3ZTABC456",
    statementdate: "6 Jan 2025",
    amount: "$167.77",
    amountpaid: "13.25",
    Balance: "$2.99",
    status: "Partially Paid",
  },
  {
    client: "70M6VJN",
    name: "Sky B",
    petname: "Kizie",
    statement: "3ZTABC456",
    statementdate: "6 Jan 2025",
    amount: "$167.77",
    amountpaid: "13.25",
    Balance: "$2.99",
    status: "Paid",
  },
  {
    client: "70M6VJN",
    name: "Sky B",
    petname: "Kizie",
    statement: "3ZTABC456",
    statementdate: "6 Jan 2025",
    amount: "$167.77",
    amountpaid: "13.25",
    Balance: "$2.99",
    status: "Overdue",
  },
  {
    client: "70M6VJN",
    name: "Sky B",
    petname: "Kizie",
    statement: "3ZTABC456",
    statementdate: "6 Jan 2025",
    amount: "$167.77",
    amountpaid: "13.25",
    Balance: "$2.99",
    status: "Paid",
  },
  {
    client: "70M6VJN",
    name: "Sky B",
    petname: "Kizie",
    statement: "3ZTABC456",
    statementdate: "6 Jan 2025",
    amount: "$167.77",
    amountpaid: "13.25",
    Balance: "$2.99",
    status: "Paid",
  },
  {
    client: "70M6VJN",
    name: "Sky B",
    petname: "Kizie",
    statement: "3ZTABC456",
    statementdate: "6 Jan 2025",
    amount: "$167.77",
    amountpaid: "13.25",
    Balance: "$2.99",
    status: "Paid",
  },
 
];



type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render: (item: T) => React.ReactNode;
};

const columns: Column<ClientStatementsItem>[] = [

 {
    label: "Client ID",
    key: "client",
    render: (item: ClientStatementsItem) => <p>{item.client}</p>,
  },
  {
    label: "Name",
    key: "name",
    render: (item: ClientStatementsItem) => 
    <div>
        <p>{item.name}</p>
        <span className="owner"><Image aria-hidden src="https://d2il6osz49gpup.cloudfront.net/Images/paws.png" alt="paws" width={14} height={14} /> {item.petname}</span>
    </div>,
  },
  
{
    label: "Statement #",
    key: "statement",
    render: (item: ClientStatementsItem) => <p>{item.statement}</p>,
  },
  {
    label: "Statement Date",
    key: "statementdate",
    render: (item: ClientStatementsItem) => <p>{item.statementdate}</p>,
  },
  {
    label: "Total Amount",
    key: "amount",
    render: (item: ClientStatementsItem) => <p>{item.amount}</p>,
  },
  {
    label: "Amount Paid",
    key: "amountpaid",
    render: (item: ClientStatementsItem) => <p>{item.amountpaid}</p>,
  },
  {
    label: "Balance",
    key: "Balance",
    render: (item: ClientStatementsItem) => <p>{item.Balance}</p>,
  },
  {
    label: "Status",
    key: "status",
    render: (item: ClientStatementsItem) => (
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
          <Icon icon="solar:eye-bold" width={24} height={24} />
        </Button>
        <Button variant="link" className="action-btn">
          <Icon icon="solar:file-download-bold" width={24} height={24} />
        </Button>
      </div>
    ),
  },
];


function ClientStatementsTable() {

    const [selectedStatus, setSelectedStatus] = useState("Amount");
    const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("Payment Status");
    const [search, setSearch] = useState("");
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Implement search logic here
        alert(`Searching for: ${search}`);
    };
    const [selectedDoctor, setSelectedDoctor] = useState("Last 30 Days");


  return (
    <>

    <div className="TableDropdownWrapper">
        <div className="StatementsTopBar">
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
          <OverviewDisp hideTitle={true} showDropdown={true} selectedDoctor={selectedDoctor} setSelectedDoctor={setSelectedDoctor}/>
        </div>
        <div className="table-wrapper">
            <GenericTable data={estimates} columns={columns} bordered={false} />
        </div>
    </div>



    </>
  )
}

export default ClientStatementsTable