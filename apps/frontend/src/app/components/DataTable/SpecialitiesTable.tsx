import React from "react";
import GenericTable from "../GenericTable/GenericTable";
import { SpecialityWeb } from "@/app/types/speciality";
import { Service } from "@yosemite-crew/types";
import SpecialitiesCard from "../Cards/SpecialitiesCard";
import { Column, NoDataMessage, ViewButton, ProfileTitle } from "./common";

import "./DataTable.css";

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
        <ProfileTitle>{item.name}</ProfileTitle>
      ),
    },
    {
      label: "Services",
      key: "Services",
      width: "35%",
      render: (item: SpecialityWeb) => (
        <ProfileTitle>{getServiceNames(item.services) || "-"}</ProfileTitle>
      ),
    },
    {
      label: "Team members",
      key: "Team members",
      width: "15%",
      render: (item: SpecialityWeb) => (
        <ProfileTitle>{item.teamMemberIds?.length || 0}</ProfileTitle>
      ),
    },
    {
      label: "Head",
      key: "Head",
      width: "20%",
      render: (item: SpecialityWeb) => (
        <div className="flex items-center gap-2">
          <ProfileTitle>{item.headName || "-"}</ProfileTitle>
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: SpecialityWeb) => (
        <div className="action-btn-col">
          <ViewButton onClick={() => handleViewSpeciality(item)} />
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
        {filteredList.length === 0 ? (
          <NoDataMessage />
        ) : (
          filteredList.map((item, i) => (
            <SpecialitiesCard
              key={item.name + i}
              speciality={item}
              handleViewSpeciality={handleViewSpeciality}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default SpecialitiesTable;
