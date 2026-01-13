import React from "react";
import { SpecialityWeb } from "@/app/types/speciality";
import { getServiceNames } from "../../DataTable/SpecialitiesTable";
import { Secondary } from "../../Buttons";

type SpecialitiesCardProps = {
  speciality: SpecialityWeb;
  handleViewSpeciality: any;
};

const SpecialitiesCard = ({
  speciality,
  handleViewSpeciality,
}: SpecialitiesCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-1">
        <div className="text-body-3-emphasis text-text-primary">
          {speciality.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Services:</div>
        <div className="text-caption-1 text-text-primary">
          {getServiceNames(speciality.services)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">
          Assigned team members:
        </div>
        <div className="text-caption-1 text-text-primary">
          {speciality.teamMemberIds?.length}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Head:</div>
        <div className="text-caption-1 text-text-primary">
          {speciality.headName}
        </div>
      </div>
      <div className="flex gap-3 w-full">
        <Secondary
          href="#"
          onClick={() => handleViewSpeciality(speciality)}
          text="View"
          className="w-full"
        />
      </div>
    </div>
  );
};

export default SpecialitiesCard;
