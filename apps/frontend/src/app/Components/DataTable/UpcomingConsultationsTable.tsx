"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import "./DataTable.css"
import { Button } from "react-bootstrap";
import { Icon } from "@iconify/react/dist/iconify.js";

type UpcomconstItem = {

    appointmentId: string;
    date: string;
    time: string;
    reason: string;
    vetname: string;
    vetrole: string;

};

const data: UpcomconstItem[] = [

  {
    appointmentId: "DRO01-03-23-2024",
    date: "24 Apr 2025",
    time: "10:15 AM",
    reason: "Annual Health Check-Up",
    vetname: "Dr. Emily Johnson",
    vetrole: "Dr. Emily Johnson",
  },
  {
    appointmentId: "DRO01-03-23-2024",
    date: "24 Apr 2025",
    time: "10:15 AM",
    reason: "Annual Health Check-Up",
    vetname: "Dr. Emily Johnson",
    vetrole: "Dr. Emily Johnson",
  },
 
];

const columns = [

  {
    label: "UpcomconstItem ID",
    key: "appointmentId",
    render: (item: UpcomconstItem) => (
      <p>{item?.appointmentId}</p>
    ),
  },
  {
    label: "UpcomconstItem Date",
    key: "date",
    render: (item: UpcomconstItem) => 
        <div >
            <p>{item.date}</p>
            <span>{item.time}</span>
        </div>
  },
  {
    label: "Reason for UpcomconstItem",
    key: "petType",
    render: (item: UpcomconstItem) => (
      <p>{item.reason}</p>
    ),
  },
  {
    label: "Attending Veterinarian",
    key: "attendvet",
    render: (item: UpcomconstItem) => (
      <div>
        <p>{item.vetname}</p>
        <span>
          {item.vetrole}
        </span>
      </div>
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

function UpcomingConsultationsTable() {
  return (
    <>
        <div className="table-wrapper" >
            <GenericTable data={data} columns={columns} bordered={false} />
        </div>
    </>
  )
}

export default UpcomingConsultationsTable
