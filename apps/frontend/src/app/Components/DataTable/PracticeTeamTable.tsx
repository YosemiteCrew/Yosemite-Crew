"use client";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import Image from "next/image";
import { BsEye } from "react-icons/bs"; // For the eye icon


type Appointment = {
  avatar: string;
  name: string;
  subName: string;
  appointmentId: string;
  reason: string;
  petType: string;
  petSubType: string;
  time: string;
  date: string;
  doctor: string;
  doctorDept: string;
};

const data: Appointment[] = [
  {
    avatar: "/Images/pet1.png",
    name: "Kizie",
    subName: "Sky B",
    appointmentId: "DRO01-03-23-2024",
    reason: "Annual Health Check-Up",
    petType: "Dog",
    petSubType: "Beagle",
    time: "10:15 AM",
    date: "24 Apr 2025",
    doctor: "Dr. Emily Johnson",
    doctorDept: "Cardiology",
  },
  {
    avatar: "/Images/pet2.png",
    name: "Oscar",
    subName: "Pika K",
    appointmentId: "DRO02-03-23-2024",
    reason: "Vaccination Updates",
    petType: "Cat",
    petSubType: "Egyptian Mau",
    time: "10:15 AM",
    date: "24 Apr 2025",
    doctor: "Dr. David Brown",
    doctorDept: "Gastroenterology",
  },
  {
    avatar: "/Images/pet3.png",
    name: "King",
    subName: "Henry C",
    appointmentId: "DRO03-03-23-2024",
    reason: "Deworming Treatment",
    petType: "Horse",
    petSubType: "Paso Fino",
    time: "10:30 AM",
    date: "24 Apr 2025",
    doctor: "Dr. Megan Clark",
    doctorDept: "Endocrinology",
  },
];

const columns = [
  {
    label: "",
    key: "avatar",
    width: "60px",
    render: (item: Appointment) => (
      <Image
        src={item.avatar}
        alt={item.name}
        width={40}
        height={40}
        style={{ borderRadius: "50%" }}
      />
    ),
  },
  {
    label: "Name",
    key: "name",
    // width: "0px",
    render: (item: Appointment) => (
      <div>
        <div>{item.name}</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
          <span style={{ fontSize: 13, marginRight: 4 }}>👤</span>
          {item.subName}
        </div>
      </div>
    ),
  },
  {
    label: "Appointment ID",
    key: "appointmentId",
    // width: "150px",
    render: (item: Appointment) => (
      <span style={{ fontWeight: 500 }}>{item.appointmentId}</span>
    ),
  },
  {
    label: "Reason for Appointment",
    key: "reason",
    // width: "180px",
    render: (item: Appointment) => <span>{item.reason}</span>,
  },
  {
    label: "Pet Type",
    key: "petType",
    // width: "110px",
    render: (item: Appointment) => (
      <div>
        <div style={{ fontWeight: 500 }}>{item.petType}</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
          {item.petSubType}
        </div>
      </div>
    ),
  },
  {
    label: "Time",
    key: "time",
    // width: "110px",
    render: (item: Appointment) => (
      <div>
        <div style={{ fontWeight: 500 }}>{item.time}</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
          {item.date}
        </div>
      </div>
    ),
  },
  {
    label: "Doctor",
    key: "doctor",
    // width: "150px",
    render: (item: Appointment) => (
      <div>
        <div style={{ fontWeight: 500 }}>{item.doctor}</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
          {item.doctorDept}
        </div>
      </div>
    ),
  },
  {
    label: "Actions",
    key: "actions",
    width: "60px",
    render: () => (
      <button
        style={{
          background: "#F6F6F6",
          border: "none",
          borderRadius: "50%",
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
        aria-label="View"
      >
        <BsEye size={18} color="#555" />
      </button>
    ),
  },
];



function PracticeTeamTable() {
  return (
    <>

    <div
      className="table-wrapper"
      style={{
        background: "#fff",
        borderRadius: 20,
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        padding: 0,
      }}
    >
      <GenericTable data={data} columns={columns} bordered={false} />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "16px 24px 8px 0",
        }}
      >
        <button
          style={{
            border: "1px solid #222",
            borderRadius: 20,
            background: "#fff",
            color: "#222",
            padding: "6px 28px",
            fontWeight: 500,
            fontSize: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            cursor: "pointer",
          }}
        >
          Sell All
        </button>
      </div>
    </div>


    </>
  )
}

export default PracticeTeamTable