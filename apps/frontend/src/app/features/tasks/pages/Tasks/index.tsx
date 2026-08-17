'use client';
import React, { Suspense, useCallback, useMemo, useState } from 'react';
import type { SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { IoAdd } from 'react-icons/io5';
import { Primary } from '@/app/ui/primitives/Buttons';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import TitleCalendar from '@/app/ui/widgets/TitleCalendar';
import { startOfDay } from '@/app/features/appointments/components/Calendar/weekHelpers';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import { useTasksForPrimaryOrg } from '@/app/hooks/useTask';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { Task, TaskFilters, TaskStatus, TaskStatusFilters } from '@/app/features/tasks/types/task';
import { useSearchStore } from '@/app/stores/searchStore';
import { useAuthStore } from '@/app/stores/authStore';
import { normalizeCalendarId } from '@/app/features/appointments/components/Calendar/taskCalendarAvailabilityUtils';
import { resolveTeamMemberPrimaryId } from '@/app/features/appointments/components/Calendar/appointmentDragAvailabilityUtils';
import TaskFilterBar from '@/app/features/tasks/components/TaskFilterBar';
import { useIsPhone } from '@/app/ui/layout/PhoneShell/useIsPhone';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { getPlannerLayoutClassNames, usePlannerAutoLock } from '@/app/hooks/usePlannerLayout';
import MobileSearchBar from '@/app/ui/layout/MobileSearchBar/MobileSearchBar';
import { usePhonePrimaryAction } from '@/app/ui/layout/PhoneShell/usePhonePrimaryAction';

const TASKS_PAGE_SKELETON = <PageSkeleton variant="planner" />;

/**
 * The design's task filter row carries three status pills — Pending, In progress
 * and Completed. Cancelled is not offered there, so it is trimmed from the
 * shared status list (which other surfaces still use in full).
 */
const TASK_STATUS_PILLS = TaskStatusFilters.filter((option) => option.key !== 'cancelled');

/**
 * Calendar-only audience pill. The planner header already carries the
 * Day/Week/Team switcher, so the team split needs no second control; only the
 * pet-parent filter survives, as the task-side counterpart to the appointments
 * planner's Emergencies pill.
 */
const PARENT_AUDIENCE_KEY = 'parent_task';

const TASK_CALENDAR_FILTERS = TaskFilters.flatMap((option) =>
  option.key === PARENT_AUDIENCE_KEY ? [{ ...option, dotColor: 'var(--pink)' }] : []
);

/**
 * Assignee scope, kept as a segmented control (not an audience chip) so its
 * "Team" label never reads as the "Team" audience pill sitting next to it.
 * "My tasks" narrows every view to the tasks assigned to the signed-in member.
 */
const TASK_SCOPE_OPTIONS = [
  { key: 'mine', name: 'My tasks' },
  { key: 'team', name: 'Team' },
];

const TaskPlannerSkeleton = () => (
  <div className="h-full min-h-125 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const TasksTable = dynamic(() => import('@/app/ui/tables/Tasks'), {
  loading: () => <TaskPlannerSkeleton />,
});
const TaskCalendar = dynamic(
  () => import('@/app/features/appointments/components/Calendar/TaskCalendar'),
  { loading: () => <TaskPlannerSkeleton /> }
);
const TaskBoard = dynamic(() => import('@/app/features/tasks/components/TaskBoard'), {
  loading: () => <TaskPlannerSkeleton />,
});
const AddTask = dynamic(() => import('@/app/features/tasks/pages/Tasks/Sections/AddTask'));
const TaskInfo = dynamic(() => import('@/app/features/tasks/pages/Tasks/Sections/TaskInfo'));
const ChangeTaskStatus = dynamic(
  () => import('@/app/features/tasks/pages/Tasks/Sections/ChangeStatus')
);
const RescheduleTask = dynamic(
  () => import('@/app/features/tasks/pages/Tasks/Sections/Reschedule')
);

const Tasks = () => {
  const tasks = useTasksForPrimaryOrg();
  const permissions = usePermissions();
  const canEditTasks = permissions.can(PERMISSIONS.TASKS_EDIT_ANY);
  const query = useSearchStore((s) => s.query);
  const searchParams = useSearchParams();
  const [handledDeepLink, setHandledDeepLink] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');
  const [activeScope, setActiveScope] = useState('team');
  const [addPopup, setAddPopup] = useState(false);
  const [addTaskPrefill, setAddTaskPrefill] = useState<Partial<Task> | null>(null);
  const [viewPopup, setViewPopup] = useState(false);
  const [changeStatusPopup, setChangeStatusPopup] = useState(false);
  const [changeStatusPreferredStatus, setChangeStatusPreferredStatus] = useState<TaskStatus | null>(
    null
  );
  const [reschedulePopup, setReschedulePopup] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(tasks[0] ?? null);
  const [activeCalendar, setActiveCalendar] = useState('week');
  const [activeView, setActiveView] = useState('calendar');
  const isPhone = useIsPhone();
  // The phone planner swaps the grid for a day list and never renders the
  // calendar header, so the pill row stays there. Deriving visibility once keeps
  // the rendered controls and the filters they drive from drifting apart.
  const showsTaskFilterBar = activeView === 'list' || (activeView === 'calendar' && isPhone);

  // The planner header only carries the pet-parent pill, so an audience chosen
  // in the list view cannot be shown or cleared from the calendar. Derive what
  // actually applies rather than writing the state back: no extra render, and
  // the list view keeps its own selection when the user returns to it.
  const appliedFilter =
    showsTaskFilterBar || activeFilter === PARENT_AUDIENCE_KEY ? activeFilter : 'all';
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfDay(currentDate));
  const { plannerSectionRef } = usePlannerAutoLock({ activeView });

  const teams = useTeamForPrimaryOrg();
  const authUserId = useAuthStore(
    (s) => s.attributes?.sub || s.attributes?.email || s.attributes?.['cognito:username'] || ''
  );

  // Resolve "is this task assigned to me?" the same way the calendar does, so a
  // task tagged by sub, email or team-member id still matches the signed-in user.
  const myPrimaryId = useMemo(
    () => normalizeCalendarId(resolveTeamMemberPrimaryId(teams, authUserId, normalizeCalendarId)),
    [teams, authUserId]
  );
  const isAssignedToMe = useCallback(
    (task: Task) => {
      const me = normalizeCalendarId(authUserId);
      if (!me) return false;
      if (normalizeCalendarId(task.assignedTo) === me) return true;
      const assigneePrimary = normalizeCalendarId(
        resolveTeamMemberPrimaryId(teams, task.assignedTo, normalizeCalendarId)
      );
      return assigneePrimary !== '' && assigneePrimary === myPrimaryId;
    },
    [authUserId, myPrimaryId, teams]
  );

  const handleActiveCalendarChange = useCallback(
    (next: SetStateAction<string>) => {
      setActiveCalendar((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (resolved === 'week') {
          setWeekStart(startOfDay(currentDate));
        }
        return resolved;
      });
    },
    [currentDate]
  );

  const handleCurrentDateChange = useCallback(
    (next: SetStateAction<Date>) => {
      setCurrentDate((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (activeCalendar === 'week') {
          setWeekStart(startOfDay(resolved));
        }
        return resolved;
      });
    },
    [activeCalendar]
  );

  // Reconcile the active task against the latest task list during render
  // (guarded by the previous list) instead of through an effect.
  const [prevTasks, setPrevTasks] = useState<Task[] | null>(null);
  if (prevTasks !== tasks) {
    setPrevTasks(tasks);
    setActiveTask((prev) => {
      if (tasks.length === 0) return null;
      if (prev?._id) {
        const updated = tasks.find((s) => s._id === prev._id);
        if (updated) return updated;
      }
      return tasks[0];
    });
  }

  // Deep-link handling: open the task named in the query string once its data
  // arrives, at most once per taskId.
  const deepLinkTaskId = String(searchParams.get('taskId') ?? '').trim();
  if (deepLinkTaskId && handledDeepLink !== deepLinkTaskId) {
    const target = tasks.find((task) => task._id === deepLinkTaskId);
    if (target) {
      setActiveTask(target);
      setViewPopup(true);
      setHandledDeepLink(deepLinkTaskId);
    }
  }

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filterWanted = appliedFilter.toLowerCase();
    const statusWanted = activeStatus.toLowerCase();
    const scopeToMine = activeScope === 'mine';

    return tasks.filter((item) => {
      const status = item.status?.toLowerCase();
      const filter = item.audience?.toLowerCase();

      const matchesStatus =
        activeView === 'board' || statusWanted === 'all' || status === statusWanted;
      const matchesFilter = filterWanted === 'all' || filter === filterWanted;
      const matchesQuery = !q || item.name?.toLowerCase().includes(q);
      // The scope control ships with the pill row, so scope may only narrow the
      // list while that row is on screen; otherwise a carried "My tasks" would
      // filter a view that offers no way to clear it.
      const matchesScope = !showsTaskFilterBar || !scopeToMine || isAssignedToMe(item);

      return matchesStatus && matchesFilter && matchesQuery && matchesScope;
    });
  }, [
    tasks,
    activeStatus,
    appliedFilter,
    query,
    activeView,
    activeScope,
    showsTaskFilterBar,
    isAssignedToMe,
  ]);

  const handleCreateFromCalendarSlot = useCallback(
    (prefill: { dueAt: Date; assignedTo?: string }) => {
      setAddTaskPrefill(prefill);
      setAddPopup(true);
    },
    []
  );

  const handleReuseTask = useCallback((prefill: Partial<Task>) => {
    setAddTaskPrefill(prefill);
    setViewPopup(false);
    setAddPopup(true);
  }, []);

  const openAddTask = useCallback(() => {
    setAddTaskPrefill(null);
    setAddPopup(true);
  }, []);
  // The phone FAB is rendered by PhoneShell, outside this page's tree, so it
  // reaches the same create flow the desktop "New task" button uses via the
  // primary-action event rather than through props.
  usePhonePrimaryAction('task', openAddTask);
  const { wrapperClassName, plannerSectionClassName } = getPlannerLayoutClassNames({
    activeView,
    listWrapperClassName:
      'w-full flex flex-col gap-3 h-[calc(100vh-200px)] sm:h-[calc(100vh-220px)] min-h-[620px] max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-220px)] lg:sticky lg:top-4 lg:mb-0 lg:h-[calc(100dvh-105px)] lg:min-h-[calc(100dvh-105px)] lg:max-h-[calc(100dvh-105px)]',
    plannerClassName:
      'w-full h-[calc(100vh-200px)] sm:h-[calc(100vh-220px)] min-h-[620px] max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-220px)] lg:sticky lg:top-4 lg:mb-0 lg:h-[calc(100dvh-105px)] lg:min-h-[calc(100dvh-105px)] lg:max-h-[calc(100dvh-105px)]',
  });

  let plannerContent: React.ReactNode;
  if (activeView === 'calendar') {
    // Tasks share the appointments-grade planner: the header switches between the
    // Day, Week and Team grids on tablet/desktop, while TaskCalendar drops to the
    // thumb-checkable PhoneTaskDayList below 768px.
    plannerContent = (
      <TaskCalendar
        filteredList={filteredList}
        allTasks={tasks}
        setActiveTask={setActiveTask}
        setViewPopup={setViewPopup}
        setChangeStatusPopup={setChangeStatusPopup}
        setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
        setReschedulePopup={setReschedulePopup}
        activeCalendar={activeCalendar}
        setActiveCalendar={handleActiveCalendarChange}
        currentDate={currentDate}
        setCurrentDate={handleCurrentDateChange}
        weekStart={weekStart}
        setWeekStart={setWeekStart}
        canEditTasks={canEditTasks}
        onCreateFromCalendarSlot={handleCreateFromCalendarSlot}
        filterOptions={TASK_CALENDAR_FILTERS}
        activeFilter={appliedFilter}
        setActiveFilter={setActiveFilter}
        statusOptions={TASK_STATUS_PILLS}
        activeStatus={activeStatus}
        setActiveStatus={setActiveStatus}
      />
    );
  } else if (activeView === 'board') {
    plannerContent = (
      <TaskBoard
        tasks={filteredList}
        canEditTasks={canEditTasks}
        setActiveTask={setActiveTask}
        setViewPopup={setViewPopup}
        onAddTask={openAddTask}
      />
    );
  } else {
    plannerContent = (
      <div className="h-full min-h-0 overflow-hidden">
        <TasksTable
          filteredList={filteredList}
          setActiveTask={setActiveTask}
          setViewPopup={setViewPopup}
          setChangeStatusPopup={setChangeStatusPopup}
          setChangeStatusPreferredStatus={setChangeStatusPreferredStatus}
          setReschedulePopup={setReschedulePopup}
          canEditTasks={canEditTasks}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col relative">
      <div className="yc-page-content">
        <TitleCalendar
          title="Tasks"
          description="Track to-dos, assign the team or pet parents, follow through"
          setAddPopup={(next) => {
            setAddTaskPrefill(null);
            setAddPopup(next);
          }}
          count={tasks.length}
          activeView={activeView}
          setActiveView={setActiveView}
          showAdd={false}
          viewOptions={['calendar', 'board', 'list']}
          actionBeforeAdd={
            // On phone the create action is the shell FAB, so the header CTA
            // would be a duplicate - the design's "primary action -> FAB" rule.
            canEditTasks && !isPhone ? (
              <Primary
                text="New task"
                ariaLabel="New task"
                onClick={openAddTask}
                icon={<IoAdd size={16} aria-hidden="true" />}
                // The design seats the CTA after the view toggle; this slot
                // renders before it, so flex order restores that sequence.
                className="order-1 whitespace-nowrap hover:scale-100"
              />
            ) : undefined
          }
        />
        <MobileSearchBar placeholder="Search tasks" />

        <PermissionGate
          allOf={[PERMISSIONS.TASKS_VIEW_ANY]}
          deniedResource="Tasks"
          deniedDetail="tasks and assignments"
        >
          <div className={wrapperClassName}>
            {showsTaskFilterBar && (
              <TaskFilterBar
                filterOptions={TaskFilters}
                statusOptions={TASK_STATUS_PILLS}
                scopeOptions={TASK_SCOPE_OPTIONS}
                activeFilter={activeFilter}
                activeStatus={activeStatus}
                activeScope={activeScope}
                setActiveFilter={setActiveFilter}
                setActiveStatus={setActiveStatus}
                setActiveScope={setActiveScope}
              />
            )}
            <div ref={plannerSectionRef} className={plannerSectionClassName}>
              {plannerContent}
            </div>
          </div>

          <AddTask
            showModal={addPopup}
            setShowModal={(value) => {
              setAddPopup(value);
              if (value === false) setAddTaskPrefill(null);
            }}
            prefill={addTaskPrefill}
          />
          {activeTask && viewPopup && (
            <TaskInfo
              showModal={viewPopup}
              setShowModal={setViewPopup}
              activeTask={activeTask}
              onReuseTask={handleReuseTask}
            />
          )}
          {activeTask && canEditTasks && (
            <ChangeTaskStatus
              showModal={changeStatusPopup}
              setShowModal={setChangeStatusPopup}
              activeTask={activeTask}
              preferredStatus={changeStatusPreferredStatus}
            />
          )}
          {activeTask && canEditTasks && (
            <RescheduleTask
              showModal={reschedulePopup}
              setShowModal={setReschedulePopup}
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
    <ProtectedRoute skeleton={TASKS_PAGE_SKELETON}>
      <OrgGuard skeleton={TASKS_PAGE_SKELETON}>
        <Suspense fallback={TASKS_PAGE_SKELETON}>
          <Tasks />
        </Suspense>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedTasks;
