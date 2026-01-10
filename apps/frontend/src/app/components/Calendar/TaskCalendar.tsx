import React, { useMemo } from "react";
import { isSameDay } from "./helpers";
import Header from "./common/Header";
import DayCalendar from "./Task/DayCalendar";
import WeekCalendar from "./Task/WeekCalendar";
import UserCalendar from "./Task/UserCalendar";
import { Task } from "@/app/types/task";

type TaskCalendarProps = {
  filteredList: Task[];
  setActiveTask?: (inventory: Task) => void;
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
  const handleViewTask = (appointment: Task) => {
    setActiveTask?.(appointment);
    setViewPopup?.(true);
  };

  const dayEvents = useMemo(
    () =>
      filteredList.filter((event) =>
        isSameDay(new Date(event.dueAt), currentDate)
      ),
    [filteredList, currentDate]
  );

  return (
    <div className="border border-grey-light rounded-2xl w-full flex flex-col">
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
        <UserCalendar
          events={dayEvents}
          date={currentDate}
          handleViewTask={handleViewTask}
          setCurrentDate={setCurrentDate}
        />
      )}
    </div>
  );
};

export default TaskCalendar;
