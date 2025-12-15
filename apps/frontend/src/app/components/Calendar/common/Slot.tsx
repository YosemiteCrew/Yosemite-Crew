import React from "react";
import { getStatusStyle } from "../../DataTable/Appointments";
import Image from "next/image";
import { Appointment } from "@yosemite-crew/types";

type SlotProps = {
  slotEvents: Appointment[];
  height: number;
  handleViewAppointment: (appt: Appointment) => void;
  dayIndex: number;
};

const Slot: React.FC<SlotProps> = ({
  slotEvents,
  height,
  handleViewAppointment,
  dayIndex,
}) => {
  if (slotEvents.length === 0) {
    return (
      <div
        className={`relative border-l border-grey-light ${dayIndex === 6 && "border-r"}`}
        style={{ height: `${height}px` }}
      />
    );
  }
  return (
    <div
      className={`relative overflow-auto scrollbar-hidden border-l border-grey-light ${dayIndex === 6 && "border-r"}`}
      style={{ height: `${height}px` }}
    >
      <div className="flex flex-col gap-1 rounded-2xl border border-grey-light p-2 mt-2 bg-white">
        {slotEvents.map((ev, i) => (
          <button
            key={`${ev.companion.name}-${ev.startTime.toISOString()}-${i}`}
            className="rounded px-1 py-1 flex items-center justify-between"
            style={getStatusStyle(ev.status)}
            onClick={() => handleViewAppointment(ev)}
          >
            <div className="font-satoshi text-[15px] font-medium truncate">
              {ev.companion.name}
            </div>
            <Image
              src={"https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"}
              height={30}
              width={30}
              className="rounded-full flex-none"
              alt={""}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default Slot;
