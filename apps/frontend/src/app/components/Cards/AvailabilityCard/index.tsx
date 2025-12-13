import Image from "next/image";
import React from "react";
import { Team } from "@/app/types/team";
import { isHttpsImageUrl } from "@/app/utils/urls";
import { getStatusStyle } from "../../DataTable/AvailabilityTable";

type AvailabilityCardProps = {
  team: Team;
  handleViewTeam: any;
};

const AvailabilityCard = ({ team, handleViewTeam }: AvailabilityCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-2 items-center">
        <Image
          alt={""}
          src={
            isHttpsImageUrl(team.image)
              ? team.image
              : "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
          }
          height={40}
          width={40}
          style={{ borderRadius: "50%" }}
          className="h-10 w-10 rounded-full"
        />
        <div className="flex flex-col gap-0">
          <div className="text-[13px] font-satoshi font-bold text-black-text">
            {team.name}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Role:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {team.role}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Speciality:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {team?.speciality?.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Today&apos;s Appointment:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {team.todayAppointment}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Weekly working hours:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {team.weeklyWorkingHours}
        </div>
      </div>
      <div
        style={getStatusStyle(team.status)}
        className="w-full rounded-lg h-9 flex items-center justify-center text-[15px] font-satoshi font-bold"
      >
        {team.status}
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={() => handleViewTeam(team)}
          className="w-full border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer"
        >
          View
        </button>
      </div>
    </div>
  );
};

export default AvailabilityCard;
