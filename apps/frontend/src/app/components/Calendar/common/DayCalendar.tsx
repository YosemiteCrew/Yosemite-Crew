import React, { useMemo, useRef } from "react";
import {
  EVENT_HORIZONTAL_GAP_PX,
  EVENT_VERTICAL_GAP_PX,
  getDayWithDate,
  isAllDayForDate,
  layoutDayEvents,
  TOTAL_DAY_HEIGHT_PX,
} from "../helpers";
import { LaidOutEvent } from "@/app/types/calendar";
import TimeLabels from "./TimeLabels";
import HorizontalLines from "./HorizontalLines";
import { getStatusStyle } from "../../DataTable/Appointments";
import Image from "next/image";
import { GrNext, GrPrevious } from "react-icons/gr";
import { Appointment } from "@yosemite-crew/types";

type DayCalendarProps = {
  events: Appointment[];
  date: Date;
  handleViewAppointment: any;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
};

export const DayCalendar: React.FC<DayCalendarProps> = ({
  events,
  date,
  handleViewAppointment,
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

  const laidOut: LaidOutEvent[] = useMemo(
    () => layoutDayEvents(timedEvents),
    [timedEvents]
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 py-2 border-b border-grey-light">
        <GrPrevious
          size={20}
          color="#302f2e"
          onClick={handlePrevDay}
          className="cursor-pointer"
        />
        <div className="font-grotesk font-medium text-black-text text-[18px]">
          {getDayWithDate(date)}
        </div>
        <GrNext
          size={20}
          color="#302f2e"
          onClick={handleNextDay}
          className="cursor-pointer"
        />
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
                  src={"https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"}
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
            height: TOTAL_DAY_HEIGHT_PX,
          }}
        >
          <TimeLabels />
          <div className="relative h-full">
            <HorizontalLines date={date} scrollRef={scrollRef} />
            {laidOut.map((ev, i) => {
              const widthPercent = 100 / ev.columnsCount;
              const leftPercent = widthPercent * ev.columnIndex;
              const horizontalGapPx = EVENT_HORIZONTAL_GAP_PX;
              const verticalGapPx = EVENT_VERTICAL_GAP_PX;
              return (
                <button
                  key={ev.companion.name + i}
                  className="absolute rounded-2xl! p-2 overflow-auto scrollbar-hidden whitespace-nowrap text-ellipsis flex flex-col items-start cursor-pointer"
                  style={{
                    top: ev.topPx,
                    height: Math.max(ev.heightPx - verticalGapPx, 12),
                    left: `calc(${leftPercent}% + ${horizontalGapPx}px)`,
                    width: `calc(${widthPercent}% - ${horizontalGapPx * 2}px)`,
                    ...getStatusStyle(ev.status),
                  }}
                  onClick={() => handleViewAppointment(ev)}
                >
                  <div className="font-satoshi text-[18px] font-medium">
                    {ev.concern}
                  </div>
                  <div className="font-satoshi text-[15px] font-medium">
                    {ev.lead?.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <Image
                      src={"https://d2il6osz49gpup.cloudfront.net/Images/ftafter.png"}
                      height={30}
                      width={30}
                      className="rounded-full"
                      alt=""
                    />
                    <div className="font-satoshi text-[15px] font-medium">
                      {ev.companion.name}
                    </div>
                    <div className="font-satoshi text-[15px] font-medium opacity-70">
                      {ev.companion.parent.name}
                    </div>
                  </div>
                  <div className="font-satoshi text-[15px] font-medium">
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
