import { TasksProps } from "@/app/types/tasks";
import React, { useMemo } from "react";
import { getNextWeek, getPrevWeek, getWeekDays } from "../weekHelpers";
import DayLabels from "../common/DayLabels";
import TaskSlot from "./TaskSlot";
import { eventsForDay } from "../helpers";

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
      <DayLabels
        days={days}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        taskView
      />
      <div className="overflow-y-auto overflow-x-hidden flex-1 max-h-[600px]">
        <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] gap-y-0.5">
          <div />
          <div className="grid grid-cols-7 gap-x-2">
            {days.map((day, dayIndex) => {
              const slotEvents = eventsForDay(events, day);
              return (
                <TaskSlot
                  key={day.getDate() + dayIndex}
                  slotEvents={slotEvents}
                  dayIndex={dayIndex}
                  handleViewTask={handleViewTask}
                />
              );
            })}
          </div>
          <div />
        </div>
      </div>
    </div>
  );
};

export default WeekCalendar;
