import { TasksProps } from "@/app/types/tasks";
import React, { useMemo } from "react";
import { isSameDay } from "./helpers";
import Header from "./common/Header";
import DayCalendar from "./Task/DayCalendar";
import WeekCalendar from "./Task/WeekCalendar";

type TaskCalendarProps = {
  filteredList: TasksProps[];
  setActiveTask?: (inventory: TasksProps) => void;
  setViewPopup?: (open: boolean) => void;
  activeCalendar: string;
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  weekStart: Date;
  setWeekStart: React.Dispatch<React.SetStateAction<Date>>;
};

const TaskCalendar = ({
  filteredList,
  setActiveTask,
  setViewPopup,
  activeCalendar,
  currentDate,
  setCurrentDate,
  weekStart,
  setWeekStart,
}: TaskCalendarProps) => {
  const handleViewTask = (appointment: TasksProps) => {
    setActiveTask?.(appointment);
    setViewPopup?.(true);
  };

  const dayEvents = useMemo(
    () =>
      filteredList.filter((event) =>
        isSameDay(new Date(event.due), currentDate)
      ),
    [filteredList, currentDate]
  );

  return (
    <div className="border border-grey-light rounded-2xl w-full flex flex-col mb-10!">
      <Header currentDate={currentDate} setCurrentDate={setCurrentDate} />
      {activeCalendar === "day" && (
        <DayCalendar
          events={dayEvents}
          date={currentDate}
          handleViewTask={handleViewTask}
          setCurrentDate={setCurrentDate}
        />
      )}
      {activeCalendar === "week" && (
        <WeekCalendar
          events={filteredList}
          date={currentDate}
          handleViewTask={handleViewTask}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          setCurrentDate={setCurrentDate}
        />
      )}
      {activeCalendar === "vet" && (
        <WeekCalendar
          events={filteredList}
          date={currentDate}
          handleViewTask={handleViewTask}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          setCurrentDate={setCurrentDate}
        />
      )}
    </div>
  );
};

export default TaskCalendar;
