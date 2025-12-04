import { TasksProps } from "@/app/types/tasks";
import React, { useMemo } from "react";
import { isSameDay } from "./helpers";
import Header from "./common/Header";

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

//   const dayEvents = useMemo(
//     () =>
//       filteredList.filter((event) =>
//         isSameDay(new Date(event.start), currentDate)
//       ),
//     [filteredList, currentDate]
//   );

  return (
    <div className="border border-grey-light rounded-2xl w-full flex flex-col mb-10!">
      <Header currentDate={currentDate} setCurrentDate={setCurrentDate} />
      {/* {activeCalendar === "day" && (
        <DayCalendar
          events={dayEvents}
          date={currentDate}
          handleViewAppointment={handleViewTask}
          setCurrentDate={setCurrentDate}
        />
      )}
      {activeCalendar === "week" && (
        <WeekCalendar
          events={filteredList}
          date={currentDate}
          handleViewAppointment={handleViewTask}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
          setCurrentDate={setCurrentDate}
        />
      )} */}
    </div>
  );
};

export default TaskCalendar;
