import React from "react";
import GenericTable from "../GenericTable/GenericTable";

import Image from "next/image";
import { IoEye } from "react-icons/io5";
import { Team } from "@/app/types/team";

import AvailabilityCard from "../Cards/AvailabilityCard";
import { toTitleCase } from "@/app/utils/validators";
import { getSafeImageUrl } from "@/app/utils/urls";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

export const getStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case "available":
      return { color: "#54B492", backgroundColor: "#E6F4EF" };
    case "consulting":
      return { color: "#EA3729", backgroundColor: "#FDEBEA" };
    case "off-duty":
      return { color: "#F68523", backgroundColor: "#FEF3E9" };
    case "requested":
      return { color: "#302f2e", backgroundColor: "#eaeaea" };
    default:
      return { color: "#302f2e", backgroundColor: "#6b72801a" };
  }
};

type AvailabilityTableProps = {
  filteredList: Team[];
  setActive?: (team: Team) => void;
  setView?: (open: boolean) => void;
  hideActions?: boolean;
};

const AvailabilityTable = ({
  filteredList,
  setActive,
  setView,
  hideActions = false,
}: AvailabilityTableProps) => {
  const handleViewTeam = (team: Team) => {
    setActive?.(team);
    setView?.(true);
  };

  const columns: Column<Team>[] = [
    {
      label: "",
      key: "image",
      width: "5%",
      render: (item: Team) => (
        <div className="appointment-profile w-10 h-10">
          <Image
            src={getSafeImageUrl(item.image, "person")}
            alt=""
            height={40}
            width={40}
            className="w-10 h-10 object-cover rounded-full"
          />
        </div>
      ),
    },
    {
      label: "Name",
      key: "name",
      width: "15%",
      render: (item: Team) => (
        <div className="appointment-profile">
          <div className="appointment-profile-title">{item.name || "-"}</div>
        </div>
      ),
    },
    {
      label: "Role",
      key: "role",
      width: "15%",
      render: (item: Team) => (
        <div className="appointment-profile-title">
          {toTitleCase(item.role)}
        </div>
      ),
    },
    {
      label: "Speciality",
      key: "speciality",
      width: "15%",
      render: (item: Team) => (
        <div className="appointment-profile-title">
          {Array.isArray(item?.speciality) && item.speciality.length > 0
            ? item.speciality.map((spec: any) =>
                typeof spec === "string"
                  ? spec
                  : spec?.name || JSON.stringify(spec)
              ).join(", ")
            : "-"}
        </div>
      ),
    },
    {
      label: "Today's Appointment",
      key: "today",
      width: "12.5%",
      render: (item: Team) => (
        <div className="appointment-profile-title">
          {item.todayAppointment || "0"}
        </div>
      ),
    },
    {
      label: "Weekly working hours",
      key: "weekly",
      width: "12.5%",
      render: (item: Team) => (
        <div className="appointment-profile-title">
          {item.weeklyWorkingHours || "0"}
        </div>
      ),
    },
    {
      label: "Status",
      key: "status",
      width: "15%",
      render: (item: Team) => (
        <div className="appointment-status" style={getStatusStyle(item.status)}>
          {item.status}
        </div>
      ),
    },
  ];
  const actionColoumn = {
    label: "Actions",
    key: "actions",
    width: "10%",
    render: (item: Team) => (
      <div className="action-btn-col">
        <button
          onClick={() => handleViewTeam(item)}
          className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
        >
          <IoEye size={18} color="#302F2E" />
        </button>
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
          pagination
          pageSize={5}
        />
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
          return filteredList.map((item, i) => (
            <AvailabilityCard
              key={item._id + i}
              team={item}
              handleViewTeam={handleViewTeam}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default AvailabilityTable;
