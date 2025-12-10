import { Room } from "@/app/pages/Organization/types";
import React from "react";
import GenericTable from "../GenericTable/GenericTable";

import "./DataTable.css";
import { IoEye } from "react-icons/io5";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type RoomTableProps = {
  filteredList: Room[];
  setActive?: (team: any) => void;
  setView?: (open: boolean) => void;
};

const RoomTable = ({ filteredList, setActive, setView }: RoomTableProps) => {
  const handleViewRoom = (team: any) => {
    setActive?.(team);
    setView?.(true);
  };

  const columns: Column<Room>[] = [
    {
      label: "Name",
      key: "name",
      width: "20%",
      render: (item: Room) => (
        <div className="appointment-profile-title">{item.name}</div>
      ),
    },
    {
      label: "Type",
      key: "type",
      width: "20%",
      render: (item: Room) => (
        <div className="appointment-profile-title">{item.type}</div>
      ),
    },
    {
      label: "Assigned specialities",
      key: "Assigned specialities",
      width: "25%",
      render: (item: Room) => (
        <div className="appointment-profile-title">
          {item.assignedSpeciality}
        </div>
      ),
    },
    {
      label: "Assigned staff",
      key: "Assigned staff",
      width: "25%",
      render: (item: Room) => (
        <div className="appointment-profile-title">{item.assignedStaff}</div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: Room) => (
        <div className="action-btn-col">
          <button
            onClick={() => handleViewRoom(item)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
          >
            <IoEye size={18} color="#302F2E" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <div className="hidden xl:flex">
        <GenericTable
          data={filteredList}
          columns={columns}
          bordered={false}
          pagination
          pageSize={5}
        />
      </div>
    </div>
  );
};

export default RoomTable;
