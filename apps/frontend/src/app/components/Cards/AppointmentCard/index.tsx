import Image from "next/image";
import React from "react";
import { getStatusStyle } from "../../DataTable/Appointments";
import { Appointment } from "@yosemite-crew/types";
import { formatDateLabel, formatTimeLabel } from "@/app/utils/forms";
import { toTitle } from "@/app/utils/validators";
import { Secondary } from "../../Buttons";
import { allowReschedule } from "@/app/utils/appointments";
import { getSafeImageUrl, ImageType } from "@/app/utils/urls";

type AppointmentCardProps = {
  appointment: Appointment;
  handleViewAppointment: any;
  handleRescheduleAppointment: any;
  canEditAppointments: boolean;
};

const AppointmentCard = ({
  appointment,
  handleViewAppointment,
  handleRescheduleAppointment,
  canEditAppointments,
}: AppointmentCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-card-border bg-white px-3 py-3 flex flex-col justify-between gap-2 cursor-pointer">
      <div className="flex gap-2 items-center">
        <Image
          alt={""}
          src={getSafeImageUrl("", appointment.companion.species as ImageType)}
          height={40}
          width={40}
          style={{ borderRadius: "50%" }}
          className="h-10 w-10 rounded-full"
        />
        <div className="flex flex-col gap-0">
          <div className="text-body-3-emphasis text-text-primary">
            {appointment.companion?.name}
          </div>
          <div className="text-caption-1 text-text-primary">
            {appointment.companion?.parent?.name}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Breed / Species:</div>
        <div className="text-caption-1 text-text-primary">
          {appointment.companion?.breed ||
            "-" + " / " + appointment.companion?.species}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Date / Time:</div>
        <div className="text-caption-1 text-text-primary">
          {formatDateLabel(appointment.appointmentDate) +
            " / " +
            formatTimeLabel(appointment.startTime)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Reason:</div>
        <div className="text-caption-1 text-text-primary">
          {appointment.concern}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Service:</div>
        <div className="text-caption-1 text-text-primary">
          {appointment.appointmentType?.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Room:</div>
        <div className="text-caption-1 text-text-primary">
          {appointment.room?.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Lead:</div>
        <div className="text-caption-1 text-text-primary">
          {appointment.lead?.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-caption-1 text-text-extra">Staff:</div>
        <div className="text-caption-1 text-text-primary">
          {appointment.supportStaff?.map((sup) => sup.name).join(", ")}
        </div>
      </div>
      <div
        style={getStatusStyle(appointment.status)}
        className="w-full rounded-2xl h-12 flex items-center justify-center text-body-4"
      >
        {toTitle(appointment.status)}
      </div>
      <div className="flex gap-3 w-full">
        {appointment.status === "REQUESTED" ? (
          <>
            <button className="text-body-4-emphasis w-full text-[#54B492]! bg-[#E6F4EF] rounded-2xl! h-12 flex items-center justify-center cursor-pointer">
              Accept
            </button>
            <button className="text-body-4-emphasis w-full text-[#EA3729]! bg-[#FDEBEA] rounded-2xl! h-12 flex items-center justify-center cursor-pointer">
              Cancel
            </button>
          </>
        ) : (
          <div className="flex gap-2 w-full">
            <Secondary
              href="#"
              onClick={() => handleViewAppointment(appointment)}
              text="View"
              className="w-full"
            />
            {canEditAppointments && allowReschedule(appointment.status) && (
              <Secondary
                href="#"
                onClick={() => handleRescheduleAppointment(appointment)}
                text="Reschedule"
                className="w-full"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentCard;
