"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import Image from "next/image";
import "./DataTable.css"
import { Button } from "react-bootstrap";

type TeamMember = {
  avatar: string;
  name: string;
  subName: string;
  weekHours: number;
  appointments: number;
  assessments: number;
  status: "Available" | "Off-Duty" | "Consulting";
};

const data: TeamMember[] = [
  {
    avatar: "/Images/pet.jpg",
    name: "Dr. Laura Evans",
    subName: "Senior Veterinary",
    weekHours: 36,
    appointments: 15,
    assessments: 4,
    status: "Available",
  },
  {
    avatar: "/Images/pet.jpg",
    name: "Dr. Megan Clark",
    subName: "Senior Veterinary",
    weekHours: 26,
    appointments: 8,
    assessments: 3,
    status: "Off-Duty",
  },
  {
    avatar: "/Images/pet.jpg",
    name: "Dr. Henry Scott",
    subName: "Senior Veterinary",
    weekHours: 48,
    appointments: 11,
    assessments: 8,
    status: "Consulting",
  },
];

const columns = [

  {
    label: "",
    key: "avatar",
    width: "40px",
    render: (item: TeamMember) => (
      <Image
        src={item.avatar}
        alt={item.name}
        width={40}
        height={40}
        className="PetImg"
      />
    ),
  },
  {
    label: "Name",
    key: "name",
    // width: "0px",
    render: (item: TeamMember) => (
      <div>
        <p>{item.name}</p>
        <span>{item.subName}</span>
      </div>
    ),
  },
  {
    label: "Week Working Hours",
    key: "weekHours",
    render: (item: TeamMember) => <p>{item.weekHours}</p>,
  },
  {
    label: "Appointments Today",
    key: "appointments",
    render: (item: TeamMember) => <p>{item.appointments}</p>,
  },
  {
    label: "Assessments Today",
    key: "assessments",
    render: (item: TeamMember) => <p>{item.assessments}</p>,
  },
  {
    label: "Status",
    key: "status",
    render: (item: TeamMember) => (
      <span className={`ptt-status ptt-status-${item.status.replace(" ", "").toLowerCase()}`}>
        {item.status}
      </span>
    ),
  },
];

function PracticeTeamTable() {
  return (
    <div className="table-wrapper">
      <GenericTable data={data} columns={columns} bordered={false} />
      <div className="table-footerBtn">
        <Button>Sell All</Button>
      </div>
     
    </div>
  );
}

export default PracticeTeamTable;