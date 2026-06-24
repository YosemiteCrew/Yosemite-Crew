'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Appointments from '@/app/ui/tables/Appointments';
import Tasks from '@/app/ui/tables/Tasks';

import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useTasksForPrimaryOrg } from '@/app/hooks/useTask';

import './Summary.css';
import { Appointment } from '@yosemite-crew/types';
import AppoitmentInfo from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo';
import { Task, TaskStatusFilters } from '@/app/features/tasks/types/task';
import TaskInfo from '@/app/features/tasks/pages/Tasks/Sections/TaskInfo';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import Reschedule from '@/app/features/appointments/pages/Appointments/Sections/Reschedule';
import { usePermissions } from '@/app/hooks/usePermissions';
import ChangeStatus from '@/app/features/appointments/pages/Appointments/Sections/ChangeStatus';
import { AppointmentViewIntent } from '@/app/features/appointments';
import ChangeRoom from '@/app/features/appointments/pages/Appointments/Sections/ChangeRoom';
import { AppointmentStatusFiltersUI } from '@/app/features/appointments/types/appointments';
import { normalizeAppointmentStatus } from '@/app/lib/appointments';
import Filters from '@/app/ui/filters/Filters';
import { isAppointmentRevampEnabled } from '@/app/lib/featureFlags';
import { buildWorkspaceHref } from '@/app/lib/appointmentWorkspace';
import { startRouteLoader } from '@/app/lib/routeLoader';
import ViewAppointmentOverviewModal from '@/app/features/appointments/pages/Appointments/Sections/ViewAppointmentOverviewModal';

const revampEnabled = isAppointmentRevampEnabled();

const resetActiveTableState = (
  activeTable: string,
  activeSubLabel: string,
  viewTaskPopup: boolean,
  setters: {
    setActiveSubLabel: React.Dispatch<React.SetStateAction<string>>;
    setViewTaskPopup: React.Dispatch<React.SetStateAction<boolean>>;
    setViewPopup: React.Dispatch<React.SetStateAction<boolean>>;
    setDetailPopup: React.Dispatch<React.SetStateAction<boolean>>;
    setReschedulePopup: React.Dispatch<React.SetStateAction<boolean>>;
    setChangeStatusPopup: React.Dispatch<React.SetStateAction<boolean>>;
    setChangeRoomPopup: React.Dispatch<React.SetStateAction<boolean>>;
    setViewIntent: React.Dispatch<React.SetStateAction<AppointmentViewIntent | null>>;
  }
) => {
  if (activeSubLabel !== 'all') setters.setActiveSubLabel('all');
  if (activeTable === 'Appointments') {
    if (viewTaskPopup) setters.setViewTaskPopup(false);
    return;
  }
  setters.setViewPopup(false);
  setters.setDetailPopup(false);
  setters.setReschedulePopup(false);
  setters.setChangeStatusPopup(false);
  setters.setChangeRoomPopup(false);
  setters.setViewIntent(null);
};

const getNextSelectedAppointment = (
  current: Appointment | null,
  appointments: Appointment[]
): Appointment | null => {
  if (appointments.length === 0) return null;
  if (current?.id) {
    const updated = appointments.find((item) => item.id === current.id);
    if (updated) return updated;
  }
  return appointments[0];
};

const getNextSelectedTask = (current: Task | null, tasks: Task[]): Task | null => {
  if (tasks.length === 0) return null;
  if (current?._id) {
    const updated = tasks.find((item) => item._id === current._id);
    if (updated) return updated;
  }
  return tasks[0];
};

const AppointmentTask = () => {
  const appointments = useAppointmentsForPrimaryOrg();
  const { can } = usePermissions();
  const canEditAppointments = can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const tasks = useTasksForPrimaryOrg();
  const router = useRouter();
  const [activeTable, setActiveTable] = useState('Appointments');
  const [viewPopup, setViewPopup] = useState(false);
  const [detailPopup, setDetailPopup] = useState(false);
  const [viewTaskPopup, setViewTaskPopup] = useState(false);
  const [reschedulePopup, setReschedulePopup] = useState(false);
  const [changeStatusPopup, setChangeStatusPopup] = useState(false);
  const [changeRoomPopup, setChangeRoomPopup] = useState(false);
  const [viewIntent, setViewIntent] = useState<AppointmentViewIntent | null>(null);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(
    appointments[0] ?? null
  );
  const [activeTask, setActiveTask] = useState<Task | null>(tasks[0] ?? null);
  const activeLabels =
    activeTable === 'Appointments' ? AppointmentStatusFiltersUI : TaskStatusFilters;
  const [activeSubLabel, setActiveSubLabel] = useState('all');

  useEffect(() => {
    if (!viewPopup && !detailPopup) setViewIntent(null);
  }, [viewPopup, detailPopup]);

  const prevActiveTableRef = useRef(activeTable);
  if (prevActiveTableRef.current !== activeTable) {
    prevActiveTableRef.current = activeTable;
    resetActiveTableState(activeTable, activeSubLabel, viewTaskPopup, {
      setActiveSubLabel,
      setViewTaskPopup,
      setViewPopup,
      setDetailPopup,
      setReschedulePopup,
      setChangeStatusPopup,
      setChangeRoomPopup,
      setViewIntent,
    });
  }

  useEffect(() => {
    setActiveAppointment((prev) => getNextSelectedAppointment(prev, appointments));
  }, [appointments]);

  useEffect(() => {
    setActiveTask((prev) => getNextSelectedTask(prev, tasks));
  }, [tasks]);

  const filteredList = useMemo(() => {
    if (activeTable !== 'Appointments') return [];
    if (activeSubLabel === 'all') return appointments;

    const wanted = activeSubLabel.toLowerCase();
    return appointments.filter((item) => {
      const s = normalizeAppointmentStatus(item.status)?.toLowerCase();
      return s === wanted;
    });
  }, [appointments, activeTable, activeSubLabel]);

  const filteredTaskList = useMemo(() => {
    if (activeTable !== 'Tasks') return [];
    if (activeSubLabel === 'all') return tasks;
    return tasks.filter((item) => item.status.toLowerCase() === activeSubLabel.toLowerCase());
  }, [tasks, activeTable, activeSubLabel]);

  return (
    <PermissionGate allOf={[PERMISSIONS.APPOINTMENTS_VIEW_ANY, PERMISSIONS.TASKS_VIEW_ANY]}>
      <div className="summary-container pt-1">
        <h2 className="text-text-primary text-heading-1">
          Schedule{' '}
          <span className="text-text-tertiary">
            ({activeTable === 'Appointments' ? appointments.length : tasks.length})
          </span>
        </h2>
        <div className="summary-labels flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className={`min-w-20 text-body-4 px-3 py-1.5 text-text-tertiary rounded-2xl! border! transition-all duration-300${activeTable === 'Appointments' ? ' bg-blue-light text-blue-text! border-text-brand!' : ' border-card-border! hover:bg-card-hover!'}`}
              onClick={() => setActiveTable('Appointments')}
            >
              Appointments
            </button>
            <button
              type="button"
              className={`min-w-20 text-body-4 px-3 py-1.5 text-text-tertiary rounded-2xl! border! transition-all duration-300${activeTable === 'Tasks' ? ' bg-blue-light text-blue-text! border-text-brand!' : ' border-card-border! hover:bg-card-hover!'}`}
              onClick={() => setActiveTable('Tasks')}
            >
              Tasks
            </button>
          </div>
          <Filters
            statusOptions={activeLabels}
            activeStatus={activeSubLabel}
            setActiveStatus={setActiveSubLabel}
            className="w-auto"
          />
        </div>
        {activeTable === 'Appointments' ? (
          <Appointments
            filteredList={filteredList}
            setActiveAppointment={setActiveAppointment}
            setViewPopup={setViewPopup}
            setDetailPopup={setDetailPopup}
            setReschedulePopup={setReschedulePopup}
            canEditAppointments={canEditAppointments}
            setChangeStatusPopup={setChangeStatusPopup}
            setChangeRoomPopup={setChangeRoomPopup}
            setViewIntent={setViewIntent}
            small
          />
        ) : (
          <Tasks
            filteredList={filteredTaskList}
            setActiveTask={setActiveTask}
            setViewPopup={setViewTaskPopup}
            small
          />
        )}

        {activeAppointment && revampEnabled && (
          <ViewAppointmentOverviewModal
            showModal={viewPopup}
            setShowModal={setViewPopup}
            activeAppointment={activeAppointment}
            canEditAppointments={canEditAppointments}
            onOpenDetails={(appointment, intent) => {
              setActiveAppointment(appointment);
              setViewIntent(intent ?? null);
              setViewPopup(false);
              if (appointment.id) {
                startRouteLoader();
                router.push(buildWorkspaceHref(appointment.id));
              }
            }}
          />
        )}

        {activeAppointment && (
          <AppoitmentInfo
            showModal={revampEnabled ? detailPopup : viewPopup}
            setShowModal={revampEnabled ? setDetailPopup : setViewPopup}
            activeAppointment={activeAppointment}
            initialViewIntent={viewIntent}
          />
        )}

        {activeTask && (
          <TaskInfo
            showModal={viewTaskPopup}
            setShowModal={setViewTaskPopup}
            activeTask={activeTask}
          />
        )}

        {canEditAppointments && activeAppointment && (
          <Reschedule
            showModal={reschedulePopup}
            setShowModal={setReschedulePopup}
            activeAppointment={activeAppointment}
          />
        )}
        {canEditAppointments && activeAppointment && (
          <ChangeStatus
            showModal={changeStatusPopup}
            setShowModal={setChangeStatusPopup}
            activeAppointment={activeAppointment}
          />
        )}
        {canEditAppointments && activeAppointment && (
          <ChangeRoom
            showModal={changeRoomPopup}
            setShowModal={setChangeRoomPopup}
            activeAppointment={activeAppointment}
          />
        )}
      </div>
    </PermissionGate>
  );
};

export default AppointmentTask;
