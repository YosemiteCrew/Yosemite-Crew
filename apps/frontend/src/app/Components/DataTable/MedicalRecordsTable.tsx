"use client";
import React from "react";
import { Button } from "react-bootstrap";
import { Icon } from "@iconify/react/dist/iconify.js";

import GenericTable from "@/app/components/GenericTable/GenericTable";

import "./DataTable.css";

type Appointment = {
  appointmentId: string;
  date: string;
  time: string;
  reason: string;
  vetname: string;
  followup: string;
};

const data: Appointment[] = [
  {
    appointmentId: "Dr. Laura Evans",
    date: "24 Apr 2025",
    time: "10:15 AM",
    reason: "Elevated Heart Rate",
    vetname: "Atenolol 5mg tablets — 1 tab daily",
    followup: "Revisit in 2 weeks",
  },
  {
    appointmentId: "Dr. Megan Clark",
    date: "24 Apr 2025",
    time: "10:15 AM",
    reason: "Skin Allergy",
    vetname: "Apoquel 16mg — 1 tab twice daily",
    followup: "No follow-up needed",
  },
  {
    appointmentId: "Dr. Henry Scott",
    date: "24 Apr 2025",
    time: "10:15 AM",
    reason: "Limping (Left Hind Leg)",
    vetname: "Carprofen 50mg — 1 tab with food, daily",
    followup: "Review X-ray in 10 days",
  },
];

const columns = [
  {
    label: "Attending Veterinarian",
    key: "Attending Veterinarian",
    render: (item: Appointment) => <p>{item?.appointmentId}</p>,
  },
  {
    label: "Appointment Date",
    key: "date",
    render: (item: Appointment) => (
      <div>
        <p>{item.date}</p>
        <span>{item.time}</span>
      </div>
    ),
  },
  {
    label: "Diagnosis / Concern",
    key: "petType",
    render: (item: Appointment) => <p>{item.reason}</p>,
  },
  {
    label: "Prescribed Treatment",
    key: "attendvet",
    render: (item: Appointment) => <p>{item.vetname}</p>,
  },
  {
    label: "Follow-up Status",
    key: "attendvet",
    render: (item: Appointment) => <p>{item.followup}</p>,
  },
  {
    label: "",
    key: "actions",
    width: "80px",
    render: () => (
      <div className="ConstBtn">
        <Button>
          <Icon icon="solar:eye-bold" width="24" height="24" color="#747473" />
        </Button>
      </div>
    ),
  },
];

const MedicalRecordsTable = () => {
  return (
    <div className="table-wrapper">
      <GenericTable data={data} columns={columns} bordered={false} />
    </div>
  );
};

export default MedicalRecordsTable;
