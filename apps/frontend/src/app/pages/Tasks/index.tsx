"use client";
import React, { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import TasksTable from "../../components/DataTable/Tasks";
import AddTask from "./Sections/AddTask";
import TaskInfo from "./Sections/TaskInfo";
import TitleCalendar from "@/app/components/TitleCalendar";
import { getStartOfWeek } from "@/app/components/Calendar/weekHelpers";
import TaskCalendar from "@/app/components/Calendar/TaskCalendar";
import OrgGuard from "@/app/components/OrgGuard";
import { useTasksForPrimaryOrg } from "@/app/hooks/useTask";
import { Task, TaskFilters, TaskStatusFilters } from "@/app/types/task";
import { useSearchStore } from "@/app/stores/searchStore";
import Filters from "@/app/components/Filters/Filters";
import { usePermissions } from "@/app/hooks/usePermissions";
import { PERMISSIONS } from "@/app/utils/permissions";
import { PermissionGate } from "@/app/components/PermissionGate";
import Fallback from "@/app/components/Fallback";

const Tasks = () => {
  const tasks = useTasksForPrimaryOrg();
  const { can } = usePermissions();
  const canEditTasks = can(PERMISSIONS.TASKS_EDIT_ANY);
  const query = useSearchStore((s) => s.query);
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(tasks[0] ?? null);
  const [activeCalendar, setActiveCalendar] = useState("week");
  const [activeView, setActiveView] = useState("calendar");
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

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filterWanted = activeFilter.toLowerCase();
    const statusWanted = activeStatus.toLowerCase();

    return tasks.filter((item) => {
      const status = item.status?.toLowerCase();
      const filter = item.audience?.toLowerCase();

      const matchesStatus = statusWanted === "all" || status === statusWanted;
      const matchesFilter = filterWanted === "all" || filter === filterWanted;
      const matchesQuery = !q || item.name?.toLowerCase().includes(q);

      return matchesStatus && matchesFilter && matchesQuery;
    });
  }, [tasks, activeStatus, activeFilter, query]);

  return (
    <div className="flex flex-col relative">
      <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
        <TitleCalendar
          activeCalendar={activeCalendar}
          title="Tasks"
          description="Track to-dos with calendar views, assign owners and due dates, and open each task to review details and update status."
          setActiveCalendar={setActiveCalendar}
          setAddPopup={setAddPopup}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          count={tasks.length}
          activeView={activeView}
          setActiveView={setActiveView}
          showAdd={canEditTasks}
        />

        <PermissionGate
          allOf={[PERMISSIONS.TASKS_VIEW_ANY]}
          fallback={<Fallback />}
        >
          <div className="w-full flex flex-col gap-3">
            <Filters
              filterOptions={TaskFilters}
              statusOptions={TaskStatusFilters}
              activeFilter={activeFilter}
              activeStatus={activeStatus}
              setActiveFilter={setActiveFilter}
              setActiveStatus={setActiveStatus}
            />
            {activeView === "calendar" ? (
              <TaskCalendar
                filteredList={filteredList}
                setActiveTask={setActiveTask}
                setViewPopup={setViewPopup}
                activeCalendar={activeCalendar}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                weekStart={weekStart}
                setWeekStart={setWeekStart}
              />
            ) : (
              <TasksTable
                filteredList={filteredList}
                setActiveTask={setActiveTask}
                setViewPopup={setViewPopup}
              />
            )}
          </div>

          <AddTask showModal={addPopup} setShowModal={setAddPopup} />
          {activeTask && (
            <TaskInfo
              showModal={viewPopup}
              setShowModal={setViewPopup}
              activeTask={activeTask}
            />
          )}
        </PermissionGate>
      </div>
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
