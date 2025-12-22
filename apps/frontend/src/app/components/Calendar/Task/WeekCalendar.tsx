import { TasksProps } from "@/app/types/tasks";
import React, { useMemo } from "react";
import { getNextWeek, getPrevWeek, getWeekDays } from "../weekHelpers";
import DayLabels from "./DayLabels";
import TaskSlot from "./TaskSlot";
import { eventsForDay } from "../helpers";
import { GrNext, GrPrevious } from "react-icons/gr";

type WeekCalendarProps = {
  events: TasksProps[];
  date: Date;
  handleViewTask: any;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
};

const WeekCalendar: React.FC<WeekCalendarProps> = ({
  events,
  date,
  handleViewTask,
  weekStart,
  setWeekStart,
  setCurrentDate,
}) => {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

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

  return (
    <div className="h-full flex flex-col">
      <div className="grid h-full grid-cols-[40px_minmax(0,1fr)_40px]">
        <div className="flex items-start justify-center pt-3">
          <GrPrevious
            size={20}
            color="#302f2e"
            className="cursor-pointer"
            onClick={handlePrevWeek}
          />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <DayLabels days={days} />
            <div className="max-h-[400px] overflow-y-auto">
              <div className="grid grid-flow-col auto-cols-[200px] gap-x-2 min-w-max">
                {days.map((day, dayIndex) => (
                  <TaskSlot
                    key={day.getTime()}
                    slotEvents={eventsForDay(events, day)}
                    dayIndex={dayIndex}
                    handleViewTask={handleViewTask}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-start justify-center pt-3">
          <GrNext
            size={20}
            color="#302f2e"
            className="cursor-pointer"
            onClick={handleNextWeek}
          />
        </div>
      </div>
    </div>
  );
};

export default WeekCalendar;
