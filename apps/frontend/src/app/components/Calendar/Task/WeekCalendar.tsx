import React, { useMemo } from "react";
import { getNextWeek, getPrevWeek, getWeekDays } from "../weekHelpers";
import DayLabels from "./DayLabels";
import TaskSlot from "./TaskSlot";
import { eventsForDay } from "../helpers";
import { Task } from "@/app/types/task";
import Back from "../../Icons/Back";
import Next from "../../Icons/Next";

type WeekCalendarProps = {
  events: Task[];
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
          <Back onClick={handlePrevWeek} />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <DayLabels days={days} />
            <div className="max-h-[500px] overflow-y-auto">
              <div className="grid grid-flow-col auto-cols-[200px] min-w-max">
                {days.map((day, index) => (
                  <TaskSlot
                    key={day.getTime()}
                    height={300}
                    slotEvents={eventsForDay(events, day)}
                    handleViewTask={handleViewTask}
                    index={index}
                    length={days.length-1}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-start justify-center pt-3">
          <Next onClick={handleNextWeek} />
        </div>
      </div>
    </div>
  );
};

export default WeekCalendar;
