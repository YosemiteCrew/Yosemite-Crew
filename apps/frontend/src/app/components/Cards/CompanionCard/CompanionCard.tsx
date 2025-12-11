import Image from "next/image";
import React from "react";
import { getStatusStyle } from "../../DataTable/CompanionsTable";
import { CompanionProps } from "@/app/pages/Companions/types";

type CompanionCardProps = {
  companion: CompanionProps;
  handleViewCompanion: (companion: CompanionProps) => void;
};

const CompanionCard = ({
  companion,
  handleViewCompanion,
}: CompanionCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-2 items-center">
        <Image
          alt={companion.name}
          src={companion.image}
          height={40}
          width={40}
          style={{ borderRadius: "50%" }}
          className="h-10 w-10 rounded-full"
        />
        <div className="flex flex-col gap-0">
          <div className="text-[13px] font-satoshi font-bold text-black-text">
            {companion.name}
          </div>
          <div className="text-[13px] font-satoshi font-bold text-grey-noti">
            {companion.breed + " / " + companion.species}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Parent / Co-parent:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {companion.parent}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Gender / Age:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {companion.gender + " - " + companion.age}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Last Medication:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {companion.lastMedication}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Upcoming appointment:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {companion.upcomingAppointent +
            " " +
            companion.upcomingAppointentTime}
        </div>
      </div>
      <div
        style={getStatusStyle(companion.status)}
        className="w-full rounded-lg h-9 flex items-center justify-center text-[15px] font-satoshi font-bold"
      >
        {companion.status.charAt(0).toUpperCase() + companion.status.slice(1)}
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={() => handleViewCompanion(companion)}
          className="w-1/2 border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer"
        >
          View
        </button>
        <button className="w-1/2 border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer">
          Schedule
        </button>
      </div>
    </div>
  );
};

export default CompanionCard;
