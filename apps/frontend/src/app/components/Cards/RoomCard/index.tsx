import React from "react";
import { OrganisationRoom } from "@yosemite-crew/types";
import { joinNames } from "../../DataTable/RoomTable";
import { Secondary } from "../../Buttons";

type RoomCardProps = {
  room: OrganisationRoom;
  handleViewRoom: any;
  specialityNameById: Record<string, string>;
  staffNameById: Record<string, string>;
};

const RoomCard = ({
  room,
  handleViewRoom,
  staffNameById,
  specialityNameById,
}: RoomCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">
          {room.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Type:</div>
        <div className="text-caption-1 text-text-primary">{room.type}</div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">
          Assigned specialities:
        </div>
        <div className="text-caption-1 text-text-primary">
          {joinNames(specialityNameById, room.assignedSpecialiteis)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Assigned staff:</div>
        <div className="text-caption-1 text-text-primary">
          {joinNames(staffNameById, room.assignedStaffs)}
        </div>
      </div>
      <div className="flex gap-3 w-full">
        <Secondary
          href="#"
          onClick={() => handleViewRoom(room)}
          text="View"
          className="w-full"
        />
      </div>
    </div>
  );
};

export default RoomCard;
