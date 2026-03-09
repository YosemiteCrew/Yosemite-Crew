'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import TasksTable from '@/app/ui/tables/Tasks';
import AddTask from '@/app/features/tasks/pages/Tasks/Sections/AddTask';
import TaskInfo from '@/app/features/tasks/pages/Tasks/Sections/TaskInfo';
import TitleCalendar from '@/app/ui/widgets/TitleCalendar';
import { startOfDay } from '@/app/features/appointments/components/Calendar/weekHelpers';
import TaskCalendar from '@/app/features/appointments/components/Calendar/TaskCalendar';
import TaskBoard from '@/app/features/tasks/components/TaskBoard';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { useTasksForPrimaryOrg } from '@/app/hooks/useTask';
import { Task, TaskFilters, TaskStatusFilters } from '@/app/features/tasks/types/task';
import { useSearchStore } from '@/app/stores/searchStore';
import Filters from '@/app/ui/filters/Filters';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';

const Tasks = () => {
  const tasks = useTasksForPrimaryOrg();
  const { can } = usePermissions();
  const canEditTasks = can(PERMISSIONS.TASKS_EDIT_ANY);
  const query = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const handledDeepLinkRef = useRef<string | null>(null);
  const plannerSectionRef = useRef<HTMLDivElement | null>(null);
  const plannerAutoLockRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');
  const [addPopup, setAddPopup] = useState(false);
  const [viewPopup, setViewPopup] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(tasks[0] ?? null);
  const [activeCalendar, setActiveCalendar] = useState('week');
  const [activeView, setActiveView] = useState('calendar');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(startOfDay(currentDate));

  useEffect(() => {
    if (activeView === 'list') return;
    if (typeof window === 'undefined') return;

    lastScrollYRef.current = window.scrollY;

    const onScroll = () => {
      const section = plannerSectionRef.current;
      if (!section) return;

      const currentY = window.scrollY;
      const isScrollingDown = currentY > lastScrollYRef.current;
      lastScrollYRef.current = currentY;

      const rect = section.getBoundingClientRect();
      const shouldLockToSection =
        isScrollingDown &&
        rect.top <= 140 &&
        rect.top >= -220 &&
        rect.bottom > window.innerHeight * 0.55;

      if (shouldLockToSection && !plannerAutoLockRef.current) {
        plannerAutoLockRef.current = true;
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (rect.top > 220) {
        plannerAutoLockRef.current = false;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [activeView]);

  useEffect(() => {
    if (activeCalendar === 'week') {
      setWeekStart(startOfDay(currentDate));
    }
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

  useEffect(() => {
    const taskId = String(searchParams.get('taskId') ?? '').trim();
    if (!taskId) return;
    if (handledDeepLinkRef.current === taskId) return;

    const target = tasks.find((task) => task._id === taskId);
    if (!target) return;

    setActiveTask(target);
    setViewPopup(true);
    handledDeepLinkRef.current = taskId;
  }, [tasks, searchParams]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filterWanted = activeFilter.toLowerCase();
    const statusWanted = activeStatus.toLowerCase();

    return tasks.filter((item) => {
      const status = item.status?.toLowerCase();
      const filter = item.audience?.toLowerCase();

      const matchesStatus =
        activeView === 'board' || statusWanted === 'all' || status === statusWanted;
      const matchesFilter = filterWanted === 'all' || filter === filterWanted;
      const matchesQuery = !q || item.name?.toLowerCase().includes(q);

      return matchesStatus && matchesFilter && matchesQuery;
    });
  }, [tasks, activeStatus, activeFilter, query, activeView]);

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
          viewOptions={['calendar', 'board', 'list']}
        />

        <PermissionGate allOf={[PERMISSIONS.TASKS_VIEW_ANY]} fallback={<Fallback />}>
          <div className="w-full flex flex-col gap-3">
            {activeView !== 'board' && (
              <Filters
                filterOptions={TaskFilters}
                statusOptions={TaskStatusFilters}
                activeFilter={activeFilter}
                activeStatus={activeStatus}
                setActiveFilter={setActiveFilter}
                setActiveStatus={setActiveStatus}
              />
            )}
            <div
              ref={plannerSectionRef}
              className={
                activeView === 'list'
                  ? 'w-full'
                  : 'w-full h-[calc(100vh-220px)] min-h-[620px] max-h-[calc(100vh-220px)]'
              }
            >
              {activeView === 'calendar' ? (
                <TaskCalendar
                  filteredList={filteredList}
                  allTasks={tasks}
                  setActiveTask={setActiveTask}
                  setViewPopup={setViewPopup}
                  activeCalendar={activeCalendar}
                  setActiveCalendar={setActiveCalendar}
                  currentDate={currentDate}
                  setCurrentDate={setCurrentDate}
                  weekStart={weekStart}
                  setWeekStart={setWeekStart}
                  canEditTasks={canEditTasks}
                />
              ) : activeView === 'board' ? (
                <TaskBoard
                  tasks={filteredList}
                  currentDate={currentDate}
                  setCurrentDate={setCurrentDate}
                  canEditTasks={canEditTasks}
                  setActiveTask={setActiveTask}
                  setViewPopup={setViewPopup}
                  onAddTask={() => setAddPopup(true)}
                />
              ) : (
                <TasksTable
                  filteredList={filteredList}
                  setActiveTask={setActiveTask}
                  setViewPopup={setViewPopup}
                />
              )}
            </div>
          </div>

          <AddTask showModal={addPopup} setShowModal={setAddPopup} />
          {activeTask && viewPopup && (
            <TaskInfo showModal={viewPopup} setShowModal={setViewPopup} activeTask={activeTask} />
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
