"use client";
import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import TasksTable from "../../components/DataTable/Tasks";
import AddTask from "./Sections/AddTask";
import TaskInfo from "./Sections/TaskInfo";
import TaskFilters from "@/app/components/Filters/TasksFilters";
import TitleCalendar from "@/app/components/TitleCalendar";
import { getStartOfWeek } from "@/app/components/Calendar/weekHelpers";
import TaskCalendar from "@/app/components/Calendar/TaskCalendar";
import OrgGuard from "@/app/components/OrgGuard";
import {
  useLoadTasksForPrimaryOrg,
  useTasksForPrimaryOrg,
} from "@/app/hooks/useTask";
import { Task } from "@/app/types/task";

const Tasks = () => {
  useLoadTasksForPrimaryOrg();
  const tasks = useTasksForPrimaryOrg();

  const [filteredList, setFilteredList] = useState<Task[]>(tasks);
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(tasks[0] ?? null);
  const [activeCalendar, setActiveCalendar] = useState("week");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(getStartOfWeek(currentDate));

  useEffect(() => {
    setWeekStart(getStartOfWeek(currentDate));
  }, [currentDate, activeCalendar]);

  useEffect(() => {
    setActiveTask((prev) => {
      if (tasks.length === 0) return null;
      if (prev?._id) {
        const updated = tasks.find((s) => s._id === prev._id);
        if (updated) return updated;
      }
      return tasks[0];
    });
  }, [tasks]);

  return (
    <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
      <TitleCalendar
        activeCalendar={activeCalendar}
        title="Tasks"
        setActiveCalendar={setActiveCalendar}
        setAddPopup={setAddPopup}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        count={tasks.length}
      />

      <div className="w-full flex flex-col gap-3">
        <TaskFilters list={tasks} setFilteredList={setFilteredList} />
        <TaskCalendar
          filteredList={tasks}
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
      <OrgGuard>
        <Tasks />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedTasks;
