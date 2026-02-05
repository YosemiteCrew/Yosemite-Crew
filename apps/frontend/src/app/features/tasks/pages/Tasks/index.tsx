"use client";
import React, { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/app/ui/layout/guards/ProtectedRoute";
import TasksTable from "@/app/ui/tables/Tasks";
import AddTask from "@/app/features/tasks/pages/Tasks/Sections/AddTask";
import TaskInfo from "@/app/features/tasks/pages/Tasks/Sections/TaskInfo";
import TitleCalendar from "@/app/ui/widgets/TitleCalendar";
import { getStartOfWeek } from "@/app/features/appointments/components/Calendar/weekHelpers";
import TaskCalendar from "@/app/features/appointments/components/Calendar/TaskCalendar";
import OrgGuard from "@/app/ui/layout/guards/OrgGuard";
import { useTasksForPrimaryOrg } from "@/app/hooks/useTask";
import { Task, TaskFilters, TaskStatusFilters } from "@/app/features/tasks/types/task";
import { useSearchStore } from "@/app/stores/searchStore";
import Filters from "@/app/ui/filters/Filters";
import { usePermissions } from "@/app/hooks/usePermissions";
import { PERMISSIONS } from "@/app/lib/permissions";
import { PermissionGate } from "@/app/ui/layout/guards/PermissionGate";
import Fallback from "@/app/ui/overlays/Fallback";

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
          description="Track to-dos with calendar views, assign pet parents and due dates, and open each task to review details and update status."
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
