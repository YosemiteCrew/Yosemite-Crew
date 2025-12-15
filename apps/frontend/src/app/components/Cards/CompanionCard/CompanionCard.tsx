import Image from "next/image";
import React from "react";
import { getStatusStyle } from "../../DataTable/CompanionsTable";
import { CompanionParent } from "@/app/pages/Companions/types";
import { getAgeInYears } from "@/app/utils/date";
import { isHttpsImageUrl } from "@/app/utils/urls";

type CompanionCardProps = {
  companion: CompanionParent;
  handleViewCompanion: (companion: CompanionParent) => void;
  handleBookAppointment: (companion: CompanionParent) => void;
};

const CompanionCard = ({
  companion,
  handleViewCompanion,
  handleBookAppointment,
}: CompanionCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-2 items-center">
        <Image
          alt={""}
          src={
            isHttpsImageUrl(companion.companion.photoUrl)
              ? companion.companion.photoUrl
              : "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
          }
          height={40}
          width={40}
          style={{ borderRadius: "50%" }}
          className="h-10 w-10 rounded-full"
        />
        <div className="flex flex-col gap-0">
          <div className="text-[13px] font-satoshi font-bold text-black-text">
            {companion.companion.name}
          </div>
          <div className="text-[13px] font-satoshi font-bold text-grey-noti">
            {companion.companion.breed + " / " + companion.companion.type}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Parent / Co-parent:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {companion.parent.firstName}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Gender / Age:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {companion.companion.gender +
            " - " +
            getAgeInYears(companion.companion.dateOfBirth)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Allergies:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {companion.companion.allergy || "-"}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Upcoming appointment:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {"-"}
        </div>
      </div>
      <div
        style={getStatusStyle(companion.companion.status || "inactive")}
        className="w-full rounded-lg h-9 flex items-center justify-center text-[15px] font-satoshi font-bold"
      >
        {companion.companion.status || "inactive"}
      </div>
      <div className="flex gap-2 w-full">
        <button
          onClick={() => handleViewCompanion(companion)}
          className="w-1/2 border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer"
        >
          View
        </button>
        <button
          onClick={() => handleBookAppointment(companion)}
          className="w-1/2 border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer"
        >
          Schedule
        </button>
        <button className="w-1/2 border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer">
          Task
        </button>
      </div>
    </div>
  );
};

export default CompanionCard;
