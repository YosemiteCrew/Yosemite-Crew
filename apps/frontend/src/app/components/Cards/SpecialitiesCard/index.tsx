import React from "react";
import { SpecialityWeb } from "@/app/types/speciality";
import { getServiceNames } from "../../DataTable/SpecialitiesTable";

type SpecialitiesCardProps = {
  speciality: SpecialityWeb;
  handleViewSpeciality: any;
};

const SpecialitiesCard = ({
  speciality,
  handleViewSpeciality,
}: SpecialitiesCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-[23px] font-satoshi font-bold text-black-text">
          {speciality.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Services:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {getServiceNames(speciality.services)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Assigned team members:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {speciality.teamMemberIds?.length}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Head:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {speciality.headName}
        </div>
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={() => handleViewSpeciality(speciality)}
          className="w-full border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer"
        >
          View
        </button>
      </div>
    </div>
  );
};

export default SpecialitiesCard;
