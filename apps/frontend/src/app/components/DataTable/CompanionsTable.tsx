"use client";
import React from "react";
import { FaCalendar, FaTasks } from "react-icons/fa";
import { IoEye } from "react-icons/io5";
import Image from "next/image";

import CompanionCard from "../Cards/CompanionCard/CompanionCard";
import GenericTable from "../GenericTable/GenericTable";
import { CompanionParent } from "../../pages/Companions/types";

import { getAgeInYears } from "@/app/utils/date";
import { isHttpsImageUrl } from "@/app/utils/urls";
import { toTitleCase } from "@/app/utils/validators";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type CompanionsTableProps = {
  filteredList: CompanionParent[];
  activeCompanion: CompanionParent | null;
  setActiveCompanion: (companion: CompanionParent) => void;
  setViewCompanion: (open: boolean) => void;
  setBookAppointment: (open: boolean) => void;
};

export const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case "active":
      return { color: "#fff", backgroundColor: "#D28F9A" };
    case "archived":
      return { color: "#fff", backgroundColor: "#BF9FAA" };
    case "inactive":
      return { color: "#fff", backgroundColor: "#747283" };
    default:
      return { color: "#fff", backgroundColor: "rgba(107,114,128,0.1)" };
  }
};

const CompanionsTable = ({
  filteredList,
  activeCompanion,
  setActiveCompanion,
  setViewCompanion,
  setBookAppointment,
}: CompanionsTableProps) => {
  const handleViewCompanion = (companion: CompanionParent) => {
    setActiveCompanion(companion);
    setViewCompanion(true);
  };

  const handleBookAppointment = (companion: CompanionParent) => {
    setActiveCompanion(companion);
    setBookAppointment(true);
  };

  const columns: Column<CompanionParent>[] = [
    {
      label: "",
      key: "image",
      width: "5%",
      render: (item: CompanionParent) => (
        <div className="appointment-profile w-10 h-10">
          <Image
            src={
              isHttpsImageUrl(item.companion.photoUrl)
                ? item.companion.photoUrl
                : "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
            }
            alt=""
            height={40}
            width={40}
            style={{
              borderRadius: "50%",
              objectFit: "cover",
              maxWidth: "40px",
              minWidth: "40px",
              maxHeight: "40px",
            }}
          />
        </div>
      ),
    },
    {
      label: "Name",
      key: "name",
      width: "15%",
      render: (item: CompanionParent) => (
        <div className="appointment-profile">
          <div className="appointment-profile-two">
            <div className="appointment-profile-title">
              {item.companion.name}
            </div>
            <div className="flex items-center">
              <div className="appointment-profile-sub truncate max-w-[60px]">
                {item.companion.breed}
              </div>
              <div className="appointment-profile-sub">
                {"/" + item.companion.type}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      label: "Parent",
      key: "parent",
      width: "10%",
      render: (item: CompanionParent) => (
        <div className="appointment-profile-title">{item.parent.firstName}</div>
      ),
    },
    {
      label: "Gender/Age",
      key: "gender/age",
      width: "10%",
      render: (item: CompanionParent) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">
            {item.companion.gender}
          </div>
          <div className="appointment-profile-title">
            {getAgeInYears(item.companion.dateOfBirth)}
          </div>
        </div>
      ),
    },
    {
      label: "Allergy",
      key: "allergy",
      width: "15%",
      render: (item: CompanionParent) => (
        <div className="appointment-profile-title">
          {item.companion.allergy || "-"}
        </div>
      ),
    },
    {
      label: "Upcoming Appointment",
      key: "Upcoming Appointment",
      width: "20%",
      render: (item: CompanionParent) => (
        <div className="appointment-profile-two">
          <div className="appointment-profile-title">{"-"}</div>
          <div className="appointment-profile-sub">{""}</div>
        </div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: CompanionParent) => (
        <div
          className="appointment-status"
          style={getStatusStyle(item.companion.status || "inactive")}
        >
          {toTitleCase(item.companion.status || "inactive")}
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: CompanionParent) => (
        <div className="action-btn-col">
          <button
            onClick={() => handleViewCompanion(item)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={20} color="#302F2E" />
          </button>
          <button
            onClick={() => handleBookAppointment(item)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <FaCalendar size={14} color="#302F2E" />
          </button>
          <button className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer">
            <FaTasks size={14} color="#302F2E" />
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
              <div className="w-full py-6 flex items-center justify-center text-body-4 text-text-primary">
                No data available
              </div>
            );
          }
          return filteredList.map((companion, index) => (
            <CompanionCard
              key={index + companion.companion.name}
              companion={companion}
              handleViewCompanion={handleViewCompanion}
              handleBookAppointment={handleBookAppointment}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default CompanionsTable;
