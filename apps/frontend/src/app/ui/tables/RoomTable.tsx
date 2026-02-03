import React, { useMemo } from "react";
import GenericTable from "@/app/ui/tables/GenericTable/GenericTable";
import RoomCard from "@/app/ui/cards/RoomCard";
import { OrganisationRoom, Speciality } from "@yosemite-crew/types";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { Team } from "@/app/features/organization/types/team";
import { toTitle } from "@/app/lib/validators";
import { Column, NoDataMessage, ViewButton, ProfileTitle } from "@/app/ui/tables/common";

import "./DataTable.css";

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
      const name = s.name ?? "";
      if (s.practionerId) {
        acc[s.practionerId] = name;
      }
      if (s._id) {
        acc[s._id] = name;
      }
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
        <ProfileTitle>{item.name}</ProfileTitle>
      ),
    },
    {
      label: "Type",
      key: "type",
      width: "20%",
      render: (item: OrganisationRoom) => (
        <ProfileTitle>{toTitle(item.type)}</ProfileTitle>
      ),
    },
    {
      label: "Assigned specialities",
      key: "Assigned specialities",
      width: "25%",
      render: (item: OrganisationRoom) => (
        <ProfileTitle>
          {joinNames(specialityNameById, item.assignedSpecialiteis)}
        </ProfileTitle>
      ),
    },
    {
      label: "Assigned staff",
      key: "Assigned staff",
      width: "25%",
      render: (item: OrganisationRoom) => (
        <ProfileTitle>
          {joinNames(staffNameById, item.assignedStaffs)}
        </ProfileTitle>
      ),
    },
    {
      label: "Actions",
      key: "actions",
      width: "10%",
      render: (item: OrganisationRoom) => (
        <div className="action-btn-col">
          <ViewButton onClick={() => handleViewRoom(item)} />
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
            <RoomCard
              key={item.name + i}
              room={item}
              handleViewRoom={handleViewRoom}
              staffNameById={staffNameById}
              specialityNameById={specialityNameById}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default RoomTable;
