import React from "react";
import { getStatusStyle } from "@/app/config/statusConfig";
import Image from "next/image";
import { Appointment } from "@yosemite-crew/types";
import { getSafeImageUrl, ImageType } from "@/app/lib/urls";
import { allowReschedule } from "@/app/lib/appointments";
import { IoIosCalendar } from "react-icons/io";

type SlotProps = {
  slotEvents: Appointment[];
  height: number;
  handleViewAppointment: (appt: Appointment) => void;
  handleRescheduleAppointment: (appt: Appointment) => void;
  dayIndex: number;
  length: number;
  canEditAppointments: boolean;
};

const Slot: React.FC<SlotProps> = ({
  slotEvents,
  height,
  handleViewAppointment,
  handleRescheduleAppointment,
  dayIndex,
  length,
  canEditAppointments,
}) => {
  if (slotEvents.length === 0) {
    return (
      <div
        className={`relative border-l border-grey-light text-caption-1 text-text-primary flex items-center justify-center ${dayIndex === length && "border-r"}`}
        style={{ height: `${height}px` }}
      >
        No appointments
      </div>
    );
  }
  return (
    <div
      className={`relative overflow-auto scrollbar-hidden border-l border-grey-light ${dayIndex === length && "border-r"}`}
      style={{ height: `${height}px` }}
    >
      <div className="flex flex-col gap-1 rounded-2xl p-2 bg-white">
        {slotEvents.map((ev, i) => (
          <div
            key={`${ev.companion.name}-${ev.startTime.toISOString()}-${i}`}
            className="rounded px-1 py-1 flex items-center justify-between"
            style={getStatusStyle(ev.status)}
          >
            <button
              type="button"
              className="flex-1 min-w-0 flex items-center justify-between cursor-pointer"
              onClick={() => handleViewAppointment(ev)}
            >
              <div className="text-body-4 truncate">{ev.companion.name}</div>
              <div className="flex items-center gap-1">
                <Image
                  src={getSafeImageUrl("", ev.companion.species.toLowerCase() as ImageType)}
                  height={30}
                  width={30}
                  className="rounded-full flex-none"
                  alt={""}
                />
              </div>
            </button>
            {canEditAppointments && allowReschedule(ev.status) && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRescheduleAppointment(ev);
                }}
                className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-[30px] w-[30px] rounded-full! border border-black-white! flex items-center justify-center cursor-pointer"
              >
                <IoIosCalendar size={16} color="#fff" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Slot;
