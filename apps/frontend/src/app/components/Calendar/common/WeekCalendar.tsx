import { AppointmentsProps } from "@/app/types/appointments";
import React, { useMemo } from "react";
import {
  eventsForDayHour,
  getNextWeek,
  getPrevWeek,
  getWeekDays,
  HOURS_IN_DAY,
} from "../weekHelpers";
import DayLabels from "./DayLabels";
import { MINUTES_PER_STEP, PIXELS_PER_STEP } from "../helpers";
import Image from "next/image";
import { getStatusStyle } from "../../DataTable/Appointments";

type WeekCalendarProps = {
  events: AppointmentsProps[];
  date: Date;
  handleViewAppointment: any;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
};

const WeekCalendar: React.FC<WeekCalendarProps> = ({
  events,
  date,
  handleViewAppointment,
  weekStart,
  setWeekStart,
}) => {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const height = (PIXELS_PER_STEP / MINUTES_PER_STEP) * 60;

  const handlePrevWeek = () => {
    setWeekStart((prev) => getPrevWeek(prev));
  };

  const handleNextWeek = () => {
    setWeekStart((prev) => getNextWeek(prev));
  };

  return (
    <div className="h-full flex flex-col">
      <DayLabels
        days={days}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
      />
      <div className="overflow-y-scroll overflow-x-hidden flex-1 px-2">
        <div className="grid grid-cols-[80px_minmax(0,1fr)_80px]">
          {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
            <React.Fragment key={hour}>
              <div
                className="font-satoshi text-[13px] text-[#747473] font-medium"
                style={{ height: height + "px", opacity: hour === 0 ? 0 : 1 }}
              >
                {new Date(0, 0, 0, hour, 0, 0).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day, dayIndex) => {
                  const slotEvents = eventsForDayHour(events, day, hour);
                  return (
                    <div
                      key={dayIndex + day.getDate()}
                      className="relative"
                      style={{ height: height + "px" }}
                    >
                      {slotEvents.length > 0 && (
                        <div className="flex flex-col gap-1 rounded-2xl border border-grey-light p-2">
                          {slotEvents.map((ev) => (
                            <div
                              key={ev.name}
                              className="rounded px-1 py-1 flex items-center justify-between"
                              style={getStatusStyle(ev.status)}
                            >
                              <div className="font-satoshi text-[15px] font-medium truncate">
                                {ev.name + "kmwx wnxsiw wjsnxwi"}
                              </div>
                              <Image
                                src={ev.image}
                                height={30}
                                width={30}
                                className="rounded-full flex-none"
                                alt=""
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="opacity-0">Right</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeekCalendar;
