import Image from "next/image";
import React from "react";
import { getStatusStyle } from "../../DataTable/Appointments";
import { Appointment } from "@yosemite-crew/types";
import { formatDateLabel } from "@/app/utils/forms";

type AppointmentCardProps = {
  appointment: Appointment;
  handleViewAppointment: any;
};

const AppointmentCard = ({
  appointment,
  handleViewAppointment,
}: AppointmentCardProps) => {
  return (
    <div className="sm:min-w-[280px] w-full sm:w-[calc(50%-12px)] rounded-2xl border border-[#EAEAEA] bg-[#FFFEFE] px-3 py-4 flex flex-col justify-between gap-2.5 cursor-pointer">
      <div className="flex gap-2 items-center">
        <Image
          alt={""}
          src={"https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"}
          height={40}
          width={40}
          style={{ borderRadius: "50%" }}
          className="h-10 w-10 rounded-full"
        />
        <div className="flex flex-col gap-0">
          <div className="text-[13px] font-satoshi font-bold text-black-text">
            {appointment.companion?.name}
          </div>
          <div className="text-[13px] font-satoshi font-bold text-grey-noti">
            {appointment.companion?.parent?.name}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Breed / Species:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {appointment.companion?.breed ||
            "-" + " / " + appointment.companion?.species}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Date / Time:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {formatDateLabel(appointment.appointmentDate) +
            " / " +
            formatDateLabel(appointment.startTime)}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Reason:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {appointment.concern}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Service:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {appointment.appointmentType?.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Room:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {appointment.room?.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Lead:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {appointment.lead?.name}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="text-[13px] font-satoshi font-bold text-grey-noti">
          Staff:
        </div>
        <div className="text-[13px] font-satoshi font-bold text-black-text">
          {appointment.supportStaff?.map((sup) => sup.name).join(", ")}
        </div>
      </div>
      <div
        style={getStatusStyle(appointment.status)}
        className="w-full rounded-lg h-9 flex items-center justify-center text-[15px] font-satoshi font-bold"
      >
        {appointment.status.charAt(0).toUpperCase() +
          appointment.status.slice(1)}
      </div>
      <div className="flex gap-3 w-full">
        {appointment.status === "REQUESTED" ? (
          <>
            <button className="w-full text-[#54B492]! bg-[#E6F4EF] rounded-2xl! h-12 flex items-center justify-center cursor-pointer">
              Accept
            </button>
            <button className="w-full text-[#EA3729]! bg-[#FDEBEA] rounded-2xl! h-12 flex items-center justify-center cursor-pointer">
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => handleViewAppointment(appointment)}
            className="w-full border border-black-text! rounded-2xl! h-12 flex items-center justify-center cursor-pointer"
          >
            View
          </button>
        )}
      </div>
    </div>
  );
};

export default AppointmentCard;
