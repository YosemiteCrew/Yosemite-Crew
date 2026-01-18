import Image from "next/image";
import React from "react";
import { Team } from "@/app/types/team";
import { getSafeImageUrl } from "@/app/utils/urls";
import { getStatusStyle } from "../../DataTable/AvailabilityTable";
import { toTitleCase } from "@/app/utils/validators";
import { Secondary } from "../../Buttons";

type AvailabilityCardProps = {
  team: Team;
  handleViewTeam: any;
};

const AvailabilityCard = ({ team, handleViewTeam }: AvailabilityCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-2 items-center">
        <div className="h-10 w-10">
          <Image
            alt={""}
            src={getSafeImageUrl(team.image, "person")}
            height={40}
            width={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        </div>
        <div className="flex flex-col gap-0">
          <div className="text-body-3-emphasis text-text-primary">
            {team.name}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Role:</div>
        <div className="text-caption-1 text-text-primary">
          {toTitleCase(team.role)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Speciality:</div>
        <div className="text-caption-1 text-text-primary">
          {team?.speciality?.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">
          Today&apos;s Appointment:
        </div>
        <div className="text-caption-1 text-text-primary">
          {team.todayAppointment}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">
          Weekly working hours:
        </div>
        <div className="text-caption-1 text-text-primary">
          {team.weeklyWorkingHours}
        </div>
      </div>
      <div
        style={getStatusStyle(team.status)}
        className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
      >
        {team.status}
      </div>
      <Secondary
        href="#"
        onClick={() => handleViewTeam(team)}
        text="View"
        className="w-full"
      />
    </div>
  );
};

export default AvailabilityCard;
