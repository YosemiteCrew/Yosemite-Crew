import React from "react";
import { OrganisationRoom } from "@yosemite-crew/types";
import { getStringified } from "../../DataTable/RoomTable";

type RoomCardProps = {
  room: OrganisationRoom;
  handleViewRoom: any;
};

const RoomCard = ({ room, handleViewRoom }: RoomCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-[23px] font-satoshi font-bold text-black-text">
          {room.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Type:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {room.type}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Assigned specialities:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {getStringified(room.assignedSpecialiteis)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Assigned staff:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {getStringified(room.assignedStaffs)}
        </div>
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={() => handleViewRoom(room)}
          className="w-full border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer"
        >
          View
        </button>
      </div>
    </div>
  );
};

export default RoomCard;
