import React, { useState } from "react";
import GenericTable from "../GenericTable/GenericTable";
import Image from "next/image";
import Link from "next/link";
import { FaCheckCircle } from "react-icons/fa";
import { IoIosCloseCircle } from "react-icons/io";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type AppointmentsProps = {
  name: string;
  parentName: string;
  image: string;
  reason: string;
  emergency: boolean;
  breed: string;
  species: string;
  room: string;
  time: string;
  date: string;
  lead: string;
  leadDepartment: string;
  support: string[];
  status: string;
};

const demoData: AppointmentsProps[] = [
  {
    name: "Bella",
    parentName: "Sarah Johnson",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    reason: "Annual vaccination",
    emergency: false,
    breed: "Golden Retriever",
    species: "Dog",
    room: "Room 3A",
    time: "10:30 AM",
    date: "2025-11-06",
    lead: "Dr. Emily Carter",
    leadDepartment: "Veterinary Medicine",
    support: ["Nurse Rachel", "Assistant Tom"],
    status: "Scheduled",
  },
  {
    name: "Milo",
    parentName: "John Smith",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    reason: "Limping after walk",
    emergency: true,
    breed: "Beagle",
    species: "Dog",
    room: "Emergency Bay 1",
    time: "9:15 AM",
    date: "2025-11-06",
    lead: "Dr. Mark Daniels",
    leadDepartment: "Orthopedics",

    support: ["Nurse Rachel", "Assistant Tom"],
    status: "In-Progress",
  },
  {
    name: "Luna",
    parentName: "Priya Mehta",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    reason: "Dental cleaning",
    emergency: false,
    breed: "Persian",
    species: "Cat",
    room: "Room 2B",
    time: "1:00 PM",
    date: "2025-11-06",
    lead: "Dr. Rebecca Lin",
    leadDepartment: "Dentistry",
    status: "Completed",
    support: ["Nurse Rachel", "Assistant Tom"],
  },
  {
    name: "Rocky",
    parentName: "David Lee",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    reason: "Regular checkup",
    emergency: false,
    breed: "Bulldog",
    species: "Dog",
    room: "Room 4C",
    time: "11:45 AM",
    date: "2025-11-06",
    lead: "Dr. Michael Brown",
    leadDepartment: "General Care",
    support: ["Nurse Rachel", "Assistant Tom"],
    status: "Scheduled",
  },
  {
    name: "Coco",
    parentName: "Elena Garcia",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    reason: "Skin rash and itching",
    emergency: false,
    breed: "Poodle",
    species: "Dog",
    room: "Room 1A",
    time: "3:30 PM",
    date: "2025-11-06",
    lead: "Dr. Jason Patel",
    leadDepartment: "Dermatology",
    status: "Cancelled",
    support: ["Nurse Rachel", "Assistant Tom"],
  },
];

const Appointments = () => {
  const [data] = useState<AppointmentsProps[]>(demoData);

  const columns: Column<AppointmentsProps>[] = [
    {
      label: "Name",
      key: "name",
      width: "10%",
      render: (item: AppointmentsProps) => (
        <div className="appointment-profile">
          <Image
            src={item.image}
            alt=""
            height={40}
            width={40}
            style={{ borderRadius: "50%" }}
          />
          <div className="appointment-profile-two">
            <div className="appointment-profile-title">{item.name}</div>
            <div className="appointment-profile-sub">
              {item.parentName.split(" ")[0]}
            </div>
          </div>
        </div>
      ),
    },
    {
      label: "Reason",
      key: "reason",
      width: "15%",
      render: (item: AppointmentsProps) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">{item.reason}</div>
          <div className="appointment-emergency-label">Emergency</div>
        </div>
      ),
    },
    {
      label: "Breed",
      key: "breed",
      width: "10%",
      render: (item: AppointmentsProps) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">{item.species}</div>
          <div className="appointment-profile-sub">{item.breed}</div>
        </div>
      ),
    },
    {
      label: "Room",
      key: "room",
      width: "10%",
      render: (item: AppointmentsProps) => (
        <div className="appointment-profile-title">{item.room}</div>
      ),
    },
    {
      label: "Date/Time",
      key: "date/time",
      width: "10%",
      render: (item: AppointmentsProps) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">{item.time}</div>
          <div className="appointment-profile-sub">{item.date}</div>
        </div>
      ),
    },
    {
      label: "Lead",
      key: "lead",
      width: "10%",
      render: (item: AppointmentsProps) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">{item.lead.split(" ")[0] + " " + item.lead.split(" ")[1]}</div>
          <div className="appointment-profile-sub">{item.leadDepartment.split(" ")[0]}</div>
        </div>
      ),
    },
    {
      label: "Support",
      key: "support",
      width: "10%",
      render: (item: AppointmentsProps) => (
        <div className="appointment-profile-two">
          {item.support.map((sup, i) => (
            <div key={"sup" + i} className="appointment-profile-sub">
              {/* <FaUserAlt
                size={14}
                color="#252525"
                style={{ marginRight: "4px" }}
              /> */}
              {sup.split(" ")[0]}
            </div>
          ))}
        </div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: AppointmentsProps) => (
        <div className="appointment-status">{item.status}</div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: AppointmentsProps) => (
        <div className="action-btn-col">
          <Link
            href={"#"}
            className="action-btn"
            style={{ background: "#E6F4EF" }}
          >
            <FaCheckCircle size={22} color="#54B492" />
          </Link>
          <div className="action-btn" style={{ background: "#FDEBEA" }}>
            <IoIosCloseCircle size={24} color="#EA3729" />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper">
      <div className="table-list">
        <GenericTable data={data} columns={columns} bordered={false} />
      </div>
    </div>
  );
};

export default Appointments;
