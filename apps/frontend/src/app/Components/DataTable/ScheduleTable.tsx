"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import Image from "next/image";
import "./DataTable.css";
import { Button } from "react-bootstrap";
import { FaEye, FaUser } from "react-icons/fa6";
import { memo } from "react";

type Appointment = {
  id: string;
  name: string;
  owner: string;
  image: string;
  tokenNumber: string;
  reason: string;
  petType: string;
  time: string;
  date: string;
  doctorName: string;
  specialization: string;
  status: string;
};

const columns = [
  {
    label: "",
    key: "avatar",
    width: "40px",
    render: (item: Appointment) => (
      <Image src={item.image} alt="avatar" width={40} height={40} className="PetImg" />
    ),
  },
  {
    label: "Name",
    key: "name",
    render: (item: Appointment) => (
      <div>
        <p>{item.name}</p>
        <div className="userinfo">
          <span>
            <FaUser />
          </span>
          {item.owner}
        </div>
      </div>
    ),
  },
  {
    label: "Appointment ID",
    key: "tokenNumber",
    render: (item: Appointment) => <p>{item.tokenNumber}</p>,
  },
  {
    label: "Reason for Appointment",
    key: "reason",
    render: (item: Appointment) => <p>{item.reason}</p>,
  },
  {
    label: "Pet Type",
    key: "petType",
    render: (item: Appointment) => <p>{item.petType}</p>,
  },
  {
    label: "Time",
    key: "time",
    render: (item: Appointment) => (
      <div>
        <p>{item.time}</p>
        <span>{item.date}</span>
      </div>
    ),
  },
  {
    label: "Doctor",
    key: "doctor",
    render: (item: Appointment) => (
      <div>
        <p>{item.doctorName}</p>
        <span>{item.specialization}</span>
      </div>
    ),
  },
  {
    label: "Status",
    key: "status",
    render: (item: Appointment) => <p>{item.status}</p>,
  },
  {
    label: "Actions",
    key: "actions",
    render: () => (
      <Button className="ActionEyes" aria-label="View">
        <FaEye />
      </Button>
    ),
  },
];

function ScheduleTable({ data }: { data: Appointment[] }) {
  return (
    <div className="table-wrapper">
      <GenericTable data={data} columns={columns} bordered={false} />
      <div className="table-footerBtn" style={{ justifyContent: "flex-end" }}>
        <Button>Sell All</Button>
      </div>
    </div>
  );
}

export default memo(ScheduleTable);