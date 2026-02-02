import React from "react";
import { Appointment } from "@yosemite-crew/types";
import { Secondary } from "@/app/ui/primitives/Buttons";
import { allowReschedule } from "@/app/lib/appointments";
import AppointmentCardContent from "@/app/features/appointments/components/AppointmentCardContent";

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
      <AppointmentCardContent appointment={appointment} />
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
