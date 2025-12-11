"use client";
import React from "react";
import { FaCalendar } from "react-icons/fa";
import { IoEye } from "react-icons/io5";
import Image from "next/image";

import CompanionCard from "../Cards/CompanionCard/CompanionCard";
import GenericTable from "../GenericTable/GenericTable";
import { CompanionProps } from "../../pages/Companions/types";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type CompanionsTableProps = {
  filteredList: CompanionProps[];
  activeCompanion: CompanionProps | null;
  setActiveCompanion: (companion: CompanionProps) => void;
  setViewCompanion: (open: boolean) => void;
};

export const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case "active":
      return { color: "#54B492", backgroundColor: "#E6F4EF" };
    case "archived":
      return { color: "#EA3729", backgroundColor: "#FDEBEA" };
    case "inactive":
      return { color: "#F68523", backgroundColor: "#FEF3E9" };
    default:
      return { color: "#6b7280", backgroundColor: "rgba(107,114,128,0.1)" };
  }
};

const CompanionsTable = ({
  filteredList,
  activeCompanion,
  setActiveCompanion,
  setViewCompanion,
}: CompanionsTableProps) => {
  const handleViewCompanion = (companion: CompanionProps) => {
    setActiveCompanion(companion);
    setViewCompanion(true);
  };

  const columns: Column<CompanionProps>[] = [
    {
      label: "Name",
      key: "name",
      width: "20%",
      render: (item: CompanionProps) => (
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
              {item.breed + "/" + item.species}
            </div>
          </div>
        </div>
      ),
    },
    {
      label: "Parent",
      key: "parent",
      width: "10%",
      render: (item: CompanionProps) => (
        <div className="appointment-profile-title">{item.parent}</div>
      ),
    },
    {
      label: "Gender/Age",
      key: "gender/age",
      width: "10%",
      render: (item: CompanionProps) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">{item.gender}</div>
          <div className="appointment-profile-title">{item.age}</div>
        </div>
      ),
    },
    {
      label: "Last Medication",
      key: "Last Medication",
      width: "15%",
      render: (item: CompanionProps) => (
        <div className="appointment-profile-title">{item.lastMedication}</div>
      ),
    },
    {
      label: "Upcoming Appointment",
      key: "Upcoming Appointment",
      width: "20%",
      render: (item: CompanionProps) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">
            {item.upcomingAppointent}
          </div>
          <div className="appointment-profile-sub">
            {item.upcomingAppointentTime}
          </div>
        </div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: CompanionProps) => (
        <div className="appointment-status" style={getStatusStyle(item.status)}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: CompanionProps) => (
        <div className="action-btn-col">
          <button
            onClick={() => handleViewCompanion(item)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={20} color="#302F2E" />
          </button>
          <button className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer">
            <FaCalendar size={14} color="#302F2E" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <div className="hidden xl:flex">
        <GenericTable data={filteredList} columns={columns} bordered={false} />
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
          return filteredList.map((companion, index) => (
            <CompanionCard
              key={index + companion.name}
              companion={companion}
              handleViewCompanion={handleViewCompanion}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default CompanionsTable;
