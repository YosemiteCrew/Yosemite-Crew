import React, { useEffect, useMemo, useRef } from "react";
import {
  eventsForDayHour,
  getNextWeek,
  getPrevWeek,
  getWeekDays,
  HOURS_IN_DAY,
} from "../weekHelpers";
import {
  EVENT_VERTICAL_GAP_PX,
  isAllDayForDate,
  MINUTES_PER_STEP,
  PIXELS_PER_STEP,
} from "../helpers";
import Slot from "./Slot";
import { getStatusStyle } from "../../DataTable/Appointments";
import { Appointment } from "@yosemite-crew/types";
import Back from "../../Icons/Back";
import Next from "../../Icons/Next";

const PIXELS_PER_MINUTE = PIXELS_PER_STEP / MINUTES_PER_STEP;

type WeekCalendarProps = {
  events: Appointment[];
  date: Date;
  handleViewAppointment: any;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  handleRescheduleAppointment: any;
};

const WeekCalendar: React.FC<WeekCalendarProps> = ({
  events,
  date,
  handleViewAppointment,
  weekStart,
  setWeekStart,
  setCurrentDate,
  handleRescheduleAppointment
}) => {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const height = PIXELS_PER_MINUTE * 60;

  const { allDayByDay, timedEvents } = useMemo(() => {
    const byDay: Appointment[][] = days.map(() => []);
    const timed: Appointment[] = [];
    for (const ev of events) {
      let isAllDaySomeDay = false;
      for (let idx = 0; idx < days.length; idx++) {
        const day = days[idx];
        if (isAllDayForDate(ev, day)) {
          byDay[idx].push(ev);
          isAllDaySomeDay = true;
        }
      }
      if (!isAllDaySomeDay) {
        timed.push(ev);
      }
    }
    return { allDayByDay: byDay, timedEvents: timed };
  }, [events, days]);

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

  const hasAnyAllDay = allDayByDay.some((list) => list.length > 0);

  return (
    <div className="h-full flex flex-col">
      <div
        ref={scrollRef}
        className="w-full flex-1 overflow-x-auto relative rounded-2xl max-w-[calc(100vw-32px)] sm:max-w-[calc(100vw-96px)] lg:max-w-[calc(100vw-300px)]"
      >
        <div className="max-h-[800px] overflow-y-auto w-full">
          <div className="sticky top-0 z-30 bg-white">
            <div className="grid border-b border-grey-light py-3 grid-cols-[80px_minmax(0,1fr)_80px] min-w-max bg-white">
              <div className="sticky left-0 z-40 bg-white flex items-center justify-center">
                <Back onClick={handlePrevWeek} />
              </div>
              <div className="grid grid-flow-col auto-cols-[160px] bg-white">
                {days.map((day, idx) => {
                  const weekday = day.toLocaleDateString("en-US", {
                    weekday: "short",
                  });
                  const dateNumber = day.getDate();
                  return (
                    <div
                      key={idx + day.getDate()}
                      className="flex items-center justify-center flex-col"
                    >
                      <div className="text-body-4 text-text-brand">
                        {weekday}
                      </div>
                      <div className="text-body-4-emphasis text-white h-12 w-12 flex items-center justify-center rounded-full bg-text-brand">
                        {dateNumber}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="sticky right-0 z-40 bg-white flex items-center justify-center">
                <Next onClick={handleNextWeek} />
              </div>
            </div>

            {hasAnyAllDay && (
              <div className="border-b border-grey-light bg-slate-50">
                <div className="grid py-2 grid-cols-[80px_minmax(0,1fr)_80px] min-w-max">
                  <div className="sticky left-0 z-40 bg-slate-50 text-xs font-satoshi text-[#747473] flex items-start pr-2">
                    All-day
                  </div>
                  <div className="grid grid-flow-col auto-cols-[160px] min-w-max">
                    {days.map((day, idx) => {
                      const dayAllEvents = allDayByDay[idx];
                      return (
                        <div
                          key={day.toISOString()}
                          className="flex flex-col gap-1 pr-2"
                        >
                          {dayAllEvents.map((ev) => (
                            <button
                              key={`${ev.companion.name}-${ev.startTime.toISOString()}`}
                              type="button"
                              onClick={() => handleViewAppointment(ev)}
                              className="w-full rounded-md! px-2 py-1 text-[11px] font-satoshi text-left truncate"
                              style={{
                                ...({
                                  ...getStatusStyle(ev.status),
                                  padding: undefined,
                                } as React.CSSProperties),
                              }}
                            >
                              <div className="font-medium truncate">
                                {ev.companion.name} • {ev.concern || ""}
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  <div className="sticky right-0 z-40 bg-slate-50" />
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
              <div
                key={hour}
                className="grid gap-y-0.5 grid-cols-[80px_minmax(0,1fr)_80px] min-w-max"
              >
                <div
                  className="sticky left-0 z-20 bg-white text-caption-2 text-text-primary pl-2!"
                  style={{ height: height + "px", opacity: hour === 0 ? 0 : 1 }}
                >
                  {new Date(0, 0, 0, hour, 0, 0).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                <div className="grid grid-flow-col auto-cols-[160px] min-w-max">
                  {days.map((day, dayIndex) => {
                    const slotEvents = eventsForDayHour(timedEvents, day, hour);
                    return (
                      <div
                        key={day.getDate() + dayIndex}
                        className="relative pt-2"
                        style={{ height: `${height}px` }}
                      >
                        {hour !== 0 && (
                          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 border-t border-grey-light" />
                        )}
                        <Slot
                          slotEvents={slotEvents}
                          height={height}
                          dayIndex={dayIndex}
                          handleViewAppointment={handleViewAppointment}
                          handleRescheduleAppointment={handleRescheduleAppointment}
                          length={days.length - 1}
                        />
                      </div>
                    );
                  })}
                </div>
                <div
                  className="sticky right-0 z-20 bg-white"
                  style={{ height }}
                />
              </div>
            ))}

            {nowPosition && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{ top: 0 }}
              >
                <div className="grid h-full grid-cols-[80px_minmax(0,1fr)_80px] min-w-max">
                  <div />
                  <div className="grid grid-flow-col auto-cols-[160px] min-w-max">
                    {days.map((_, idx) => (
                      <div
                        key={idx + "appointent-now-key"}
                        className="relative"
                      >
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeekCalendar;
