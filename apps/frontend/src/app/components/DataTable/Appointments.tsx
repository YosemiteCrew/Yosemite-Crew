import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import Image from "next/image";
import { FaCheckCircle } from "react-icons/fa";
import { IoIosCloseCircle } from "react-icons/io";
import { IoEye } from "react-icons/io5";
import AppointmentCard from "../Cards/AppointmentCard";
import { Appointment } from "@yosemite-crew/types";
import { formatDateLabel, formatTimeLabel } from "@/app/utils/forms";

import "./DataTable.css";
import {
  acceptAppointment,
  cancelAppointment,
} from "@/app/services/appointmentService";
import { toTitleCase } from "@/app/utils/validators";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type AppointmentTableProps = {
  filteredList: Appointment[];
  setActiveAppointment?: (appointment: Appointment) => void;
  setViewPopup?: (open: boolean) => void;
  hideActions?: boolean;
};

export const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case "no_payment":
      return { color: "#fff", backgroundColor: "#5C614B" };
    case "in_progress":
      return { color: "#fff", backgroundColor: "#BF9FAA" };
    case "completed":
      return { color: "#fff", backgroundColor: "#D28F9A" };
    case "checked_in":
      return { color: "#fff", backgroundColor: "#A8A181" };
    case "requested":
      return { color: "#fff", backgroundColor: "#747283" };
    case "cancelled":
      return { color: "#fff", backgroundColor: "#D9A488" };
    default:
      return { color: "#000", backgroundColor: "#F1D4B0" };
  }
};

const Appointments = ({
  filteredList,
  setActiveAppointment,
  setViewPopup,
  hideActions = false,
}: AppointmentTableProps) => {
  const handleViewAppointment = (appointment: Appointment) => {
    setActiveAppointment?.(appointment);
    setViewPopup?.(true);
  };

  const handleAcceptAppointment = async (appointment: Appointment) => {
    try {
      await acceptAppointment(appointment);
    } catch (error) {
      console.log(error);
    }
  };

  const handleCancelAppointment = async (appointment: Appointment) => {
    try {
      await cancelAppointment(appointment);
    } catch (error) {
      console.log(error);
    }
  };

  const columns: Column<Appointment>[] = [
    {
      label: "",
      key: "logo",
      width: "5%",
      render: (item: Appointment) => (
        <div className="appointment-profile truncate">
          <Image
            src={"https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"}
            alt=""
            height={40}
            width={40}
            style={{ borderRadius: "50%" }}
          />
        </div>
      ),
    },
    {
      label: "Name",
      key: "name",
      width: "10%",
      render: (item: Appointment) => (
        <div className="appointment-profile truncate">
          <div className="appointment-profile-two">
            <div className="appointment-profile-title">
              {item?.companion?.name || "-"}
            </div>
            <div className="appointment-profile-sub truncate">
              {item?.companion?.parent?.name || ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      label: "Reason",
      key: "reason",
      width: "10%",
      render: (item: Appointment) => (
        <div className="appointment-profile-two truncate">
          <div className="appointment-profile-title">{item.concern || "-"}</div>
          {item.isEmergency && (
            <div className="appointment-emergency-label">Emergency</div>
          )}
        </div>
      ),
    },
    {
      label: "Service",
      key: "service",
      width: "10%",
      render: (item: Appointment) => (
        <div className="appointment-profile-title">
          {item.appointmentType?.name || "-"}
        </div>
      ),
    },
    {
      label: "Room",
      key: "room",
      width: "10%",
      render: (item: Appointment) => (
        <div className="appointment-profile-title">
          {item.room?.name || "-"}
        </div>
      ),
    },
    {
      label: "Date/Time",
      key: "date/time",
      width: "10%",
      render: (item: Appointment) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">
            {formatTimeLabel(item.startTime)}
          </div>
          <div className="appointment-profile-sub">
            {formatDateLabel(item.appointmentDate)}
          </div>
        </div>
      ),
    },
    {
      label: "Lead",
      key: "lead",
      width: "10%",
      render: (item: Appointment) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">
            {item.lead?.name || "-"}
          </div>
        </div>
      ),
    },
    {
      label: "Support",
      key: "support",
      width: "10%",
      render: (item: Appointment) => (
        <div className="appointment-profile-two">
          {item.supportStaff?.map((sup, i) => (
            <div key={"sup" + i} className="appointment-profile-sub">
              {sup.name}
            </div>
          ))}
        </div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: Appointment) => (
        <div className="appointment-status" style={getStatusStyle(item.status)}>
          {toTitleCase(item.status)}
        </div>
      ),
    },
  ];
  const actionColoumn = {
    label: "Actions",
    key: "actions",
    width: "10%",
    render: (item: Appointment) => (
      <div className="action-btn-col">
        {item.status === "REQUESTED" ? (
          <>
            <button
              className="action-btn"
              style={{ background: "#E6F4EF" }}
              onClick={() => handleAcceptAppointment(item)}
            >
              <FaCheckCircle size={22} color="#54B492" />
            </button>
            <button
              onClick={() => handleCancelAppointment(item)}
              className="action-btn"
              style={{ background: "#FDEBEA" }}
            >
              <IoIosCloseCircle size={24} color="#EA3729" />
            </button>
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
  };

  const finalColoumns = hideActions ? columns : [...columns, actionColoumn];

  return (
    <div className="table-wrapper">
      <div className="table-list">
        <GenericTable
          data={filteredList}
          columns={finalColoumns}
          bordered={false}
        />
      </div>
      <div className="flex xl:hidden gap-4 sm:gap-10 flex-wrap">
        {(() => {
          if (filteredList.length === 0) {
            return (
              <div className="w-full py-6 flex items-center justify-center text-grey-noti font-satoshi font-semibold">
                No data available
              </div>
            );
          }
          return filteredList.map((item, i) => (
            <AppointmentCard
              key={"key-appointment" + i}
              appointment={item}
              handleViewAppointment={handleViewAppointment}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default Appointments;
