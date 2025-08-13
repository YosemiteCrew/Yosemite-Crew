"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import "./DataTable.css"
import { Button } from "react-bootstrap";
import { Icon } from "@iconify/react/dist/iconify.js";

type Appointment = {
    appointmentId: string;
    date: string;
    reason: string;
    vetname: string;
    followup: string;
    status: string;
};

const data: Appointment[] = [
  {
    appointmentId: "3ZTABC456",
    date: "20 Jan 2025",
    reason: "$1670.77",
    vetname: "1348.25",
    followup: "$322.52",
    status: "Partially Paid",
  },
  
];

const columns = [
  {
    label: "Statement #",
    key: "Attending Veterinarian",
    render: (item: Appointment) => (
      <p>{item?.appointmentId}</p>
    ),
  },
  {
    label: "Statement Date",
    key: "date",
    render: (item: Appointment) => 
        <p>{item.date}</p>
  },
  {
    label: "Total Amount",
    key: "petType",
    render: (item: Appointment) => (
      <p>{item.reason}</p>
    ),
  },
  {
    label: "Amount Paid",
    key: "attendvet",
    render: (item: Appointment) => (
       <p>{item.vetname}</p>
    ),
  },
  {
    label: "Balance",
    key: "attendvet",
    render: (item: Appointment) => (
       <p>{item.followup}</p>
    ),
  },
  {
    label: "Status",
    key: "status",
    render: (item: Appointment) => (
       <p style={{color:"#247AED"}}>{item.status}</p>
    ),
  },
  {
    label: "",
    key: "actions",
    width: "80px",
    render: () => (
        <div className="ConstBtn">
            <Button><Icon icon="solar:eye-bold" width="24" height="24" color="#747473" /></Button>
            <Button><Icon icon="solar:file-download-bold" width="24" height="24" color="#747473"/></Button>
        </div>
    ),
  },
];


function PetClientTable() {
  return (
    <>
        <div className="table-wrapper" >
            <GenericTable data={data} columns={columns} bordered={false} />
        </div>
    </>
  )
}

export default PetClientTable
