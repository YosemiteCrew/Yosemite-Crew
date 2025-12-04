import { AppointmentsProps } from "@/app/types/appointments";
import React, { useEffect, useMemo, useRef } from "react";
import {
  eventsForDayHour,
  getNextWeek,
  getPrevWeek,
  getWeekDays,
  HOURS_IN_DAY,
} from "../weekHelpers";
import DayLabels from "./DayLabels";
import {
  EVENT_VERTICAL_GAP_PX,
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
} from "../helpers";
import Slot from "./Slot";

const PIXELS_PER_MINUTE = PIXELS_PER_STEP / MINUTES_PER_STEP;

type WeekCalendarProps = {
  events: AppointmentsProps[];
  date: Date;
  handleViewAppointment: any;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
};

const WeekCalendar: React.FC<WeekCalendarProps> = ({
  events,
  date,
  handleViewAppointment,
  weekStart,
  setWeekStart,
  setCurrentDate,
}) => {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const height = PIXELS_PER_MINUTE * 60;

  const handlePrevWeek = () => {
    setWeekStart((prev) => {
      const nextWeekStart = getPrevWeek(prev);
      setCurrentDate(nextWeekStart);
      return nextWeekStart;
    });
  };

  const handleNextWeek = () => {
    setWeekStart((prev) => {
      const nextWeekStart = getNextWeek(prev);
      setCurrentDate(nextWeekStart);
      return nextWeekStart;
    });
  };

  const nowPosition = useMemo(() => {
    const now = new Date();
    const weekStartDay = new Date(weekStart);
    weekStartDay.setHours(0, 0, 0, 0);
    const weekEndDay = new Date(weekStartDay);
    weekEndDay.setDate(weekEndDay.getDate() + 7);
    if (now < weekStartDay || now >= weekEndDay) {
      return null;
    }
    const todayIndex = days.findIndex((day) => {
      return (
        day.getFullYear() === now.getFullYear() &&
        day.getMonth() === now.getMonth() &&
        day.getDate() === now.getDate()
      );
    });
    if (todayIndex === -1) return null;

    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const hourIndex = Math.floor(minutesSinceMidnight / 60);
    const minutesInHour = minutesSinceMidnight % 60;
    const topPx =
      hourIndex * (height + EVENT_VERTICAL_GAP_PX) +
      (minutesInHour / 60) * height +
      8;

    return { topPx, todayIndex };
  }, [weekStart, days]);

  useEffect(() => {
    if (!scrollRef.current || !nowPosition) return;
    const container = scrollRef.current;
    const target = nowPosition.topPx - container.clientHeight / 2;
    container.scrollTop = Math.max(0, target);
  }, [nowPosition]);

  return (
    <div className="h-full flex flex-col">
      <DayLabels
        days={days}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
      />
      <div
        className="overflow-y-auto overflow-x-hidden flex-1 px-2 max-h-[800px] relative"
        ref={scrollRef}
      >
        <div className="grid grid-cols-[80px_minmax(0,1fr)_80px] gap-y-0.5">
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
              <div className="relative" style={{ height: `${height}px` }}>
                {hour !== 0 && (
                  <div className="pointer-events-none absolute inset-x-0 top-2 -z-10 border-t border-grey-light" />
                )}
                <div className="grid grid-cols-7 h-full">
                  {days.map((day, dayIndex) => {
                    const slotEvents = eventsForDayHour(events, day, hour);
                    return (
                      <Slot
                        key={day.getDate() + dayIndex}
                        slotEvents={slotEvents}
                        height={height}
                        dayIndex={dayIndex}
                        handleViewAppointment={handleViewAppointment}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="opacity-0">Right</div>
            </React.Fragment>
          ))}
        </div>
        {nowPosition && (
          <div className="pointer-events-none absolute inset-0 grid grid-cols-[80px_minmax(0,1fr)_80px]">
            <div />
            <div className="grid grid-cols-7 relative">
              {days.map((_, idx) => (
                <div key={idx + "line"} className="relative">
                  {idx === nowPosition.todayIndex && (
                    <div
                      className="absolute left-1 right-0 z-10 w-full"
                      style={{
                        top: nowPosition.topPx,
                        transform: "translateY(-50%)",
                      }}
                    >
                      <div className="absolute left-[-5px] w-3 h-3 rounded-full bg-red-500 translate-y-[-50%]" />
                      <div className="border-t-2 border-t-red-500 translate-y-[-50%]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div />
          </div>
        )}
      </div>
    </div>
  );
};

export default WeekCalendar;
