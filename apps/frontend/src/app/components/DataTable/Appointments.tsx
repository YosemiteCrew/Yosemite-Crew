import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import Image from "next/image";
import Link from "next/link";
import { FaCheckCircle } from "react-icons/fa";
import { IoIosCloseCircle } from "react-icons/io";
import { AppointmentsProps } from "@/app/types/appointments";
import { IoEye } from "react-icons/io5";
import AppointmentCard from "../Cards/AppointmentCard";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type AppointmentTableProps = {
  filteredList: AppointmentsProps[];
  setActiveAppointment?: (inventory: AppointmentsProps) => void;
  setViewPopup?: (open: boolean) => void;
};

export const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case "in-progress":
      return { color: "#54B492", backgroundColor: "#E6F4EF" };
    case "completed":
      return { color: "#fff", backgroundColor: "#008F5D" };
    case "checked-in":
      return { color: "#F68523", backgroundColor: "#FEF3E9" };
    case "requested":
      return { color: "#302f2e", backgroundColor: "#eaeaea" };
    default:
      return { color: "#fff", backgroundColor: "#247AED" };
  }
};

const Appointments = ({
  filteredList,
  setActiveAppointment,
  setViewPopup,
}: AppointmentTableProps) => {
  const handleViewAppointment = (appointment: AppointmentsProps) => {
    setActiveAppointment?.(appointment);
    setViewPopup?.(true);
  };
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
          {item.emergency && (
            <div className="appointment-emergency-label">Emergency</div>
          )}
        </div>
      ),
    },
    {
      label: "Service",
      key: "service",
      width: "10%",
      render: (item: AppointmentsProps) => (
        <div className="appointment-profile-title">{item.service}</div>
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
          <div className="appointment-profile-title">
            {item.lead.split(" ")[0] + " " + item.lead.split(" ")[1]}
          </div>
          <div className="appointment-profile-sub">
            {item.leadDepartment.split(" ")[0]}
          </div>
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
        <div className="appointment-status" style={getStatusStyle(item.status)}>
          {item.status}
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: AppointmentsProps) => (
        <div className="action-btn-col">
          {item.status === "Requested" ? (
            <>
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
            </>
          ) : (
            <button
              onClick={() => handleViewAppointment(item)}
              className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
            >
              <IoEye size={20} color="#302F2E" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="table-wrapper">
      <div className="table-list">
        <GenericTable data={filteredList} columns={columns} bordered={false} />
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {filteredList.map((item, i) => (
          <AppointmentCard
            key={item.name+i}
            appointment={item}
            handleViewAppointment={handleViewAppointment}
          />
        ))}
      </div>
    </div>
  );
};

export default Appointments;
