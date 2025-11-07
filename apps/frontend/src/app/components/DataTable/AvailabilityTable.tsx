import React, { useState } from "react";
import GenericTable from "../GenericTable/GenericTable";

import "./DataTable.css";
import Image from "next/image";
import Link from "next/link";
import { FaCheckCircle } from "react-icons/fa";
import { IoIosCloseCircle } from "react-icons/io";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type AvailabilityProps = {
  name: string;
  image: string;
  role: string;
  speciality: string;
  todayAppointment: string;
  weeklyWorkingHours: string;
  status: string;
};

const demoData: AvailabilityProps[] = [
  {
    name: "Dr. Emily Johnson",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    role: "Veterinarian",
    speciality: "Surgery",
    todayAppointment: "8",
    weeklyWorkingHours: "40h",
    status: "Available",
  },
  {
    name: "Dr. Michael Brown",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    role: "Senior Vet",
    speciality: "Dentistry",
    todayAppointment: "5",
    weeklyWorkingHours: "38h",
    status: "On-Break",
  },
  {
    name: "Sarah Wilson",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    role: "Vet Assistant",
    speciality: "Animal Care",
    todayAppointment: "10",
    weeklyWorkingHours: "42h",
    status: "Available",
  },
  {
    name: "Dr. James Carter",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    role: "Veterinary Surgeon",
    speciality: "Orthopedics",
    todayAppointment: "6",
    weeklyWorkingHours: "45h",
    status: "In-Surgery",
  },
  {
    name: "Rachel Green",
    image: "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png",
    role: "Consultant Vet",
    speciality: "Dermatology",
    todayAppointment: "7",
    weeklyWorkingHours: "40h",
    status: "Available",
  },
];

const AvailabilityTable = () => {
  const [data] = useState<AvailabilityProps[]>(demoData);

  const columns: Column<AvailabilityProps>[] = [
    {
      label: "Name",
      key: "name",
      width: "20%",
      render: (item: AvailabilityProps) => (
        <div className="appointment-profile">
          <Image
            src={item.image}
            alt=""
            height={40}
            width={40}
            style={{ borderRadius: "50%" }}
          />
          <div className="appointment-profile-title">{item.name}</div>
        </div>
      ),
    },
    {
      label: "Role",
      key: "role",
      width: "15%",
      render: (item: AvailabilityProps) => (
        <div className="appointment-profile-title">{item.role}</div>
      ),
    },
    {
      label: "Speciality",
      key: "speciality",
      width: "15%",
      render: (item: AvailabilityProps) => (
        <div className="appointment-profile-title">{item.speciality}</div>
      ),
    },
    {
      label: "Today's Appointment",
      key: "today",
      width: "12.5%",
      render: (item: AvailabilityProps) => (
        <div className="appointment-profile-title">{item.todayAppointment}</div>
      ),
    },
    {
      label: "Weekly working hours",
      key: "weekly",
      width: "12.5%",
      render: (item: AvailabilityProps) => (
        <div className="appointment-profile-title">
          {item.weeklyWorkingHours}
        </div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: AvailabilityProps) => (
        <div className="appointment-status">{item.status}</div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: AvailabilityProps) => (
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

export default AvailabilityTable;
