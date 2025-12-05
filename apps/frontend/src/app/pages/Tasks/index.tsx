"use client";
import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import TasksTable from "../../components/DataTable/Tasks";
import { demoTasks } from "./demo";
import AddTask from "./Sections/AddTask";
import TaskInfo from "./Sections/TaskInfo";
import { TasksProps } from "@/app/types/tasks";
import TaskFilters from "@/app/components/Filters/TasksFilters";
import TitleCalendar from "@/app/components/TitleCalendar";
import { getStartOfWeek } from "@/app/components/Calendar/weekHelpers";
import TaskCalendar from "@/app/components/Calendar/TaskCalendar";

const Tasks = () => {
  const [list] = useState<TasksProps[]>(demoTasks);
  const [filteredList, setFilteredList] = useState<TasksProps[]>(demoTasks);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeTask, setActiveTask] = useState<TasksProps | null>(
    demoTasks[0] ?? null
  );
  const [activeCalendar, setActiveCalendar] = useState("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(getStartOfWeek(currentDate));

  useEffect(() => {
    setWeekStart(getStartOfWeek(currentDate));
  }, [currentDate, activeCalendar]);

  useEffect(() => {
    if (filteredList.length > 0) {
      setActiveTask(filteredList[0]);
    } else {
      setActiveTask(null);
    }
  }, [filteredList]);

  return (
    <div className="flex flex-col gap-8 lg:gap-20 px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <TitleCalendar
        activeCalendar={activeCalendar}
        title="Tasks"
        setActiveCalendar={setActiveCalendar}
        setAddPopup={setAddPopup}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
      />

      <div className="w-full flex flex-col gap-6">
        <TaskFilters list={list} setFilteredList={setFilteredList} />
        <TaskCalendar
          filteredList={list}
          setActiveTask={setActiveTask}
          setViewPopup={setViewPopup}
          activeCalendar={activeCalendar}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          weekStart={weekStart}
          setWeekStart={setWeekStart}
        />
        <TasksTable
          filteredList={filteredList}
          setActiveTask={setActiveTask}
          setViewPopup={setViewPopup}
        />
      </div>

      <AddTask showModal={addPopup} setShowModal={setAddPopup} />
      {activeTask && (
        <TaskInfo
          showModal={viewPopup}
          setShowModal={setViewPopup}
          activeTask={activeTask}
        />
      )}
    </div>
  );
};

const ProtectedTasks = () => {
  return (
    <ProtectedRoute>
      <Tasks />
    </ProtectedRoute>
  );
};

export default ProtectedTasks;
