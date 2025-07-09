"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import "./DataTable.css";
import { Button, Form } from "react-bootstrap";
import {  FaRegTrashAlt } from "react-icons/fa";
import { Column } from "../GenericTable/GenericTable";
import {  MdModeEditOutline } from "react-icons/md";

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

type ProcedureEstimateItem = {
  toggle: boolean;
  estimateName: string;
  description: string;
  lastModified: string;
  stdPrice: string;
  usedFor: string;
  noOfItems: number;
  status: "Paid" | "Unpaid" | "Partially Paid" | "Overdue";
  actions?: string;
};

const estimates: ProcedureEstimateItem[] = [
  {
    toggle: true,
    estimateName: "General Consultation",
    description: "Standard consultation fee & services",
    lastModified: "20 Jan 2025",
    stdPrice: "$149.00",
    usedFor: "Invoice",
    noOfItems: 3,
    status: "Paid",
  },
  {
    toggle: true,
    estimateName: "Dental Cleaning & Checkup",
    description: "Covers scaling, polishing & checkup",
    lastModified: "2 Feb 2025",
    stdPrice: "$530.00",
    usedFor: "Invoice",
    noOfItems: 4,
    status: "Paid",
  },
  {
    toggle: false,
    estimateName: "Spay/Neuter Surgery",
    description: "Includes surgery, anesthesia & recovery",
    lastModified: "31 May 2025",
    stdPrice: "$849.45",
    usedFor: "Estimate",
    noOfItems: 5,
    status: "Unpaid",
  },
  {
    toggle: true,
    estimateName: "Annual Vaccination Package",
    description: "Core vaccines & wellness exam",
    lastModified: "-",
    stdPrice: "$225.20",
    usedFor: "Customer Order",
    noOfItems: 6,
    status: "Partially Paid",
  },
  {
    toggle: false,
    estimateName: "Orthopedic Fracture Repair",
    description: "Covers pre-op, surgery & post-care",
    lastModified: "8 Jan 2025",
    stdPrice: "$1250.39",
    usedFor: "Estimate",
    noOfItems: 7,
    status: "Overdue",
  },
  {
    toggle: true,
    estimateName: "Emergency Treatment Invoice",
    description: "Critical care, diagnostics & meds",
    lastModified: "12 Feb 2025",
    stdPrice: "$345.50",
    usedFor: "Invoice",
    noOfItems: 19,
    status: "Overdue",
  },
];



const columns: Column<ProcedureEstimateItem>[] = [
  {
    label: "",
    key: "toggle",
    width: "60px",
    render: (item: ProcedureEstimateItem, index: number) => (
      <Switch
        id={`switch-${index}`}
        checked={item.toggle}
        onChange={() => console.log("Toggled", item)}
      />
    ),
  },
  {
    label: "Estimate Name",
    key: "estimateName",
    render: (item: ProcedureEstimateItem) => <p>{item.estimateName}</p>,
  },
  {
    label: "Description",
    key: "description",
    render: (item: ProcedureEstimateItem) => <p>{item.description}</p>,
  },
  {
    label: "Last Modified",
    key: "lastModified",
    render: (item: ProcedureEstimateItem) => <p>{item.lastModified}</p>,
  },
  {
    label: "Std. Price",
    key: "stdPrice",
    render: (item: ProcedureEstimateItem) => <p>{item.stdPrice}</p>,
  },
  {
    label: "Used For",
    key: "usedFor",
    render: (item: ProcedureEstimateItem) => <p>{item.usedFor}</p>,
  },
  {
    label: "No of items",
    key: "noOfItems",
    render: (item: ProcedureEstimateItem) => <p>{item.noOfItems}</p>,
  },
  {
    label: "Status",
    key: "status",
    render: (item: ProcedureEstimateItem) => (
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

function ProcedureEstimatesTable() {
  return (
    <>
      <div className="table-wrapper">
        <GenericTable data={estimates} columns={columns} bordered={false} />
      </div>
    </>
  );
}

export default ProcedureEstimatesTable;