import Image from "next/image";
import React from "react";
import { getStatusStyle } from "../../DataTable/CompanionsTable";
import { CompanionParent } from "@/app/pages/Companions/types";
import { getAgeInYears } from "@/app/utils/date";
import { getSafeImageUrl, ImageType } from "@/app/utils/urls";
import { toTitleCase } from "@/app/utils/validators";
import { Secondary } from "../../Buttons";

type CompanionCardProps = {
  companion: CompanionParent;
  handleViewCompanion: (companion: CompanionParent) => void;
  handleBookAppointment: (companion: CompanionParent) => void;
  handleAddTask: (companion: CompanionParent) => void;
  canEditAppointments: boolean;
  canEditTasks: boolean;
};

const CompanionCard = ({
  companion,
  handleViewCompanion,
  handleBookAppointment,
  handleAddTask,
  canEditAppointments,
  canEditTasks,
}: CompanionCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-2 items-center">
        <Image
          alt={""}
          src={getSafeImageUrl(
            companion.companion.photoUrl,
            companion.companion.type as ImageType,
          )}
          height={40}
          width={40}
          style={{ borderRadius: "50%" }}
          className="h-10 w-10 rounded-full"
        />
        <div className="flex flex-col gap-0">
          <div className="text-body-3-emphasis text-text-primary">
            {companion.companion.name}
          </div>
          <div className="text-caption-1 text-text-primary">
            {companion.companion.breed + " / " + companion.companion.type}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">
          Parent / Co-parent:
        </div>
        <div className="text-caption-1 text-text-primary">
          {companion.parent.firstName}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Gender / Age:</div>
        <div className="text-caption-1 text-text-primary">
          {companion.companion.gender +
            " - " +
            getAgeInYears(companion.companion.dateOfBirth)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Allergies:</div>
        <div className="text-caption-1 text-text-primary">
          {companion.companion.allergy || "-"}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">
          Upcoming appointment:
        </div>
        <div className="text-caption-1 text-text-primary">{"-"}</div>
      </div>
      <div
        style={getStatusStyle(companion.companion.status || "inactive")}
        className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
      >
        {toTitleCase(companion.companion.status || "inactive")}
      </div>
      <div className="flex gap-2 w-full">
        <Secondary
          href="#"
          onClick={() => handleViewCompanion(companion)}
          text="View"
          className="w-full"
        />
        {canEditAppointments && (
          <Secondary
            href="#"
            onClick={() => handleBookAppointment(companion)}
            text="Schedule"
            className="w-full"
          />
        )}
        {canEditTasks && (
          <Secondary
            href="#"
            onClick={() => handleAddTask(companion)}
            text="Task"
            className="w-full"
          />
        )}
      </div>
    </div>
  );
};

export default CompanionCard;
