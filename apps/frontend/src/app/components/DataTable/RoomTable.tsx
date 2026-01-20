import React, { useMemo } from "react";
import GenericTable from "../GenericTable/GenericTable";
import RoomCard from "../Cards/RoomCard";
import { IoEye } from "react-icons/io5";
import { OrganisationRoom, Speciality } from "@yosemite-crew/types";

import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { Team } from "@/app/types/team";
import { toTitle } from "@/app/utils/validators";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type RoomTableProps = {
  filteredList: OrganisationRoom[];
  setActive?: (team: any) => void;
  setView?: (open: boolean) => void;
};

export const getStringified = (services: string[] = []): string => {
  return services.join(", ");
};

export const joinNames = (byId: Record<string, string>, ids: string[] = []) => {
  const names = ids.map((id) => byId[id]).filter(Boolean);
  return names.length ? names.join(", ") : "-";
};

const RoomTable = ({ filteredList, setActive, setView }: RoomTableProps) => {
  const teams = useTeamForPrimaryOrg();
  const specialities = useSpecialitiesForPrimaryOrg();

  const staffNameById = useMemo(() => {
    return teams?.reduce((acc: Record<string, string>, s: Team) => {
      acc[s._id] = s.name ?? "";
      return acc;
    }, {});
  }, [teams]);

  const specialityNameById = useMemo(() => {
    return specialities?.reduce(
      (acc: Record<string, string>, sp: Speciality) => {
        acc[sp._id || sp.name] = sp.name ?? "";
        return acc;
      },
      {}
    );
  }, [specialities]);

  const handleViewRoom = (team: OrganisationRoom) => {
    setActive?.(team);
    setView?.(true);
  };

  const columns: Column<OrganisationRoom>[] = [
    {
      label: "Name",
      key: "name",
      width: "20%",
      render: (item: OrganisationRoom) => (
        <div className="appointment-profile-title">{item.name}</div>
      ),
    },
    {
      label: "Type",
      key: "type",
      width: "20%",
      render: (item: OrganisationRoom) => (
        <div className="appointment-profile-title">{toTitle(item.type)}</div>
      ),
    },
    {
      label: "Assigned specialities",
      key: "Assigned specialities",
      width: "25%",
      render: (item: OrganisationRoom) => (
        <div className="appointment-profile-title">
          {joinNames(specialityNameById, item.assignedSpecialiteis)}
        </div>
      ),
    },
    {
      label: "Assigned staff",
      key: "Assigned staff",
      width: "25%",
      render: (item: OrganisationRoom) => (
        <div className="appointment-profile-title">
          {joinNames(staffNameById, item.assignedStaffs)}
        </div>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: OrganisationRoom) => (
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
            <RoomCard
              key={item.name + i}
              room={item}
              handleViewRoom={handleViewRoom}
              staffNameById={staffNameById}
              specialityNameById={specialityNameById}
            />
          ));
        })()}
      </div>
    </div>
  );
};

export default RoomTable;
