import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import { IoEye } from "react-icons/io5";
import { SpecialityWeb } from "@/app/types/speciality";
import { Service } from "@yosemite-crew/types";

import "./DataTable.css";
import SpecialitiesCard from "../Cards/SpecialitiesCard";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type SpecialitiesTableProps = {
  filteredList: SpecialityWeb[];
  setActive: (speciality: any) => void;
  setView: (open: boolean) => void;
};

export const getServiceNames = (services: Service[] = []): string => {
  return services.map((s) => s.name).join(", ");
};

const SpecialitiesTable = ({
  filteredList,
  setActive,
  setView,
}: SpecialitiesTableProps) => {
  const handleViewSpeciality = (speciality: any) => {
    setActive(speciality);
    setView(true);
  };

  const columns: Column<SpecialityWeb>[] = [
    {
      label: "Speciality",
      key: "Speciality",
      width: "20%",
      render: (item: SpecialityWeb) => (
        <div className="appointment-profile-title">{item.name}</div>
      ),
    },
    {
      label: "Services",
      key: "Services",
      width: "35%",
      render: (item: SpecialityWeb) => (
        <div className="appointment-profile-title">
          {getServiceNames(item.services) || "-"}
        </div>
      ),
    },
    {
      label: "Team members",
      key: "Team members",
      width: "15%",
      render: (item: SpecialityWeb) => (
        <div className="appointment-profile-title">
          {item.teamMemberIds?.length || 0}
        </div>
      ),
    },
    {
      label: "Head",
      key: "Head",
      width: "20%",
      render: (item: SpecialityWeb) => (
        <div className="flex items-center gap-2">
          <div className="appointment-profile-title">
            {item.headName || "-"}
          </div>
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: SpecialityWeb) => (
        <div className="action-btn-col">
          <button
            onClick={() => handleViewSpeciality(item)}
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
            <SpecialitiesCard
              key={item.name + i}
              speciality={item}
              handleViewSpeciality={handleViewSpeciality}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default SpecialitiesTable;
