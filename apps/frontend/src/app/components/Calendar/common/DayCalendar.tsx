import React, { useMemo, useRef } from "react";
import {
  EVENT_HORIZONTAL_GAP_PX,
  EVENT_VERTICAL_GAP_PX,
  getDayWindow,
  getTotalWindowHeightPx,
  isAllDayForDate,
  layoutDayEvents,
} from "../helpers";
import { LaidOutEvent } from "@/app/types/calendar";
import TimeLabels from "./TimeLabels";
import HorizontalLines from "./HorizontalLines";
import { getStatusStyle } from "../../DataTable/Appointments";
import Image from "next/image";
import { Appointment } from "@yosemite-crew/types";
import Next from "../../Icons/Next";
import Back from "../../Icons/Back";
import { getSafeImageUrl, ImageType } from "@/app/utils/urls";
import { allowReschedule } from "@/app/utils/appointments";
import { IoIosCalendar } from "react-icons/io";

type DayCalendarProps = {
  events: Appointment[];
  date: Date;
  handleViewAppointment: any;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  handleRescheduleAppointment: any;
  canEditAppointments: boolean;
};

export const DayCalendar: React.FC<DayCalendarProps> = ({
  events,
  date,
  handleViewAppointment,
  handleRescheduleAppointment,
  canEditAppointments,
  setCurrentDate,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: Appointment[] = [];
    const timed: Appointment[] = [];
    for (const ev of events) {
      if (isAllDayForDate(ev, date)) {
        allDay.push(ev);
      } else {
        timed.push(ev);
      }
    }
    return { allDayEvents: allDay, timedEvents: timed };
  }, [events, date]);

  const { windowStart, windowEnd } = useMemo(
    () => getDayWindow(timedEvents),
    [timedEvents]
  );

  const totalHeightPx = useMemo(
    () => getTotalWindowHeightPx(windowStart, windowEnd),
    [windowStart, windowEnd]
  );

  const laidOut: LaidOutEvent[] = useMemo(
    () => layoutDayEvents(timedEvents, windowStart, windowEnd),
    [timedEvents, windowStart, windowEnd]
  );

  const handleNextDay = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  };

  const handlePrevDay = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  };

  const weekday = date.toLocaleDateString("en-US", {
    weekday: "long",
  });
  const dateNumber = date.getDate();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 py-2 border-b border-grey-light">
        <Back onClick={handlePrevDay} />
        <div className="flex flex-col">
          <div className="text-body-4 text-text-brand">{weekday}</div>
          <div className="text-body-4-emphasis text-white h-12 w-12 flex items-center justify-center rounded-full bg-text-brand">
            {dateNumber}
          </div>
        </div>
        <Next onClick={handleNextDay} />
      </div>
      {allDayEvents.length > 0 && (
        <div className="px-2 py-2 border-b border-grey-light bg-slate-50">
          <div className="text-xs font-satoshi text-[#747473] mb-1">
            All-day
          </div>
          <div className="flex flex-wrap gap-2">
            {allDayEvents.map((ev) => (
              <button
                key={`${ev.companion.name}-${ev.startTime.toISOString()}`}
                type="button"
                onClick={() => handleViewAppointment(ev)}
                className="flex items-center gap-2 rounded-full! px-3 py-1 text-xs font-satoshi"
                style={getStatusStyle(ev.status)}
              >
                <Image
                  src={
                    "https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"
                  }
                  height={20}
                  width={20}
                  className="rounded-full"
                  alt={""}
                />
                <span className="font-medium truncate max-w-40">
                  {ev.companion.name}
                </span>
                <span className="opacity-70 truncate max-w-[120px]">
                  {ev.concern || ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        className="overflow-y-auto overflow-x-hidden flex-1 px-2 max-h-[800px]"
        ref={scrollRef}
      >
        <div
          className="grid grid-cols-[60px_1fr]"
          style={{
            height: totalHeightPx,
          }}
        >
          <TimeLabels windowStart={windowStart} windowEnd={windowEnd} />
          <div className="relative h-full">
            <HorizontalLines
              date={date}
              scrollRef={scrollRef}
              windowStart={windowStart}
              windowEnd={windowEnd}
            />
            {laidOut.map((ev, i) => {
              const widthPercent = 100 / ev.columnsCount;
              const leftPercent = widthPercent * ev.columnIndex;
              const horizontalGapPx = EVENT_HORIZONTAL_GAP_PX;
              const verticalGapPx = EVENT_VERTICAL_GAP_PX;
              return (
                <button
                  key={ev.companion.name + i}
                  className="absolute rounded-2xl! p-2 overflow-auto scrollbar-hidden whitespace-nowrap text-ellipsis flex items-start justify-between cursor-pointer"
                  style={{
                    top: ev.topPx,
                    height: Math.max(ev.heightPx - verticalGapPx, 12),
                    left: `calc(${leftPercent}% + ${horizontalGapPx}px)`,
                    width: `calc(${widthPercent}% - ${horizontalGapPx * 2}px)`,
                    ...getStatusStyle(ev.status),
                  }}
                  onClick={() => handleViewAppointment(ev)}
                >
                  <div className="flex flex-col items-start">
                    <div className={`flex items-center gap-2`}>
                      <div className="text-body-4 opacity-70">Service:</div>
                      <div className="text-body-4">{ev.appointmentType?.name || "-"}</div>
                    </div>
                    <div className={`flex items-center gap-2`}>
                      <div className="text-body-4 opacity-70">Lead:</div>
                      <div className="text-body-4">{ev.lead?.name}</div>
                    </div>
                    <div className={`flex items-center gap-2`}>
                      <div className="text-body-4 opacity-70">Companion:</div>
                      <div className="text-body-4 flex items-center gap-1">
                        <Image
                          src={getSafeImageUrl(
                            "",
                            ev.companion.species.toLowerCase() as ImageType
                          )}
                          height={30}
                          width={30}
                          className="rounded-full"
                          alt=""
                        />
                        <div>{ev.companion.name}</div>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2`}>
                      <div className="text-body-4 opacity-70">Parent:</div>
                      <div className="text-body-4">
                        {ev.companion.parent.name}
                      </div>
                    </div>
                    <div className={`flex items-center gap-2`}>
                      <div className="text-body-4 opacity-70">Time:</div>
                      <div className="text-body-4">
                        {ev.startTime.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {" - "}
                        {ev.endTime.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    {canEditAppointments && allowReschedule(ev.status) && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRescheduleAppointment(ev);
                        }}
                        className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] h-10 w-10 rounded-full! border border-black-white! flex items-center justify-center cursor-pointer"
                      >
                        <IoIosCalendar size={18} color="#fff" />
                      </button>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayCalendar;
