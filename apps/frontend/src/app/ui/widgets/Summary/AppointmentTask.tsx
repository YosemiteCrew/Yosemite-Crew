'use client';
import React, { useEffect, useMemo, useState } from 'react';
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
import { normalizeAppointmentStatus, type LegacyAppointmentStatus } from '@/app/lib/appointments';

const AppointmentTask = () => {
  const appointments = useAppointmentsForPrimaryOrg();
  const { can } = usePermissions();
  const canEditAppointments = can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const tasks = useTasksForPrimaryOrg();
  const [activeTable, setActiveTable] = useState('Appointments');
  const [viewPopup, setViewPopup] = useState(false);
  const [viewTaskPopup, setViewTaskPopup] = useState(false);
  const [reschedulePopup, setReschedulePopup] = useState(false);
  const [changeStatusPopup, setChangeStatusPopup] = useState(false);
  const [changeRoomPopup, setChangeRoomPopup] = useState(false);
  const [viewIntent, setViewIntent] = useState<AppointmentViewIntent | null>(null);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(
    appointments[0] ?? null
  );
  const [activeTask, setActiveTask] = useState<Task | null>(tasks[0] ?? null);
  const activeLabels = useMemo(
    () => (activeTable === 'Appointments' ? AppointmentStatusFiltersUI : TaskStatusFilters),
    [activeTable]
  );
  const [activeSubLabel, setActiveSubLabel] = useState('all');

  useEffect(() => {
    if (!viewPopup) {
      setViewIntent(null);
    }
  }, [viewPopup]);

  useEffect(() => {
    if (activeTable === 'Appointments') {
      setViewTaskPopup(false);
      return;
    }

    setViewPopup(false);
    setReschedulePopup(false);
    setChangeStatusPopup(false);
    setChangeRoomPopup(false);
    setViewIntent(null);
  }, [activeTable]);

  useEffect(() => {
    setActiveAppointment((prev) => {
      if (appointments.length === 0) return null;
      if (prev?.id) {
        const updated = appointments.find((s) => s.id === prev.id);
        if (updated) return updated;
      }
      return appointments[0];
    });
  }, [appointments]);

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
    setActiveSubLabel('all');
  }, [activeTable]);

  const filteredList = useMemo(() => {
    if (activeTable !== 'Appointments') return [];
    if (activeSubLabel === 'all') return appointments;

    const wanted = activeSubLabel.toLowerCase();
    return appointments.filter((item) => {
      const s = normalizeAppointmentStatus(item.status as LegacyAppointmentStatus)?.toLowerCase();
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
        <div className="text-text-primary text-heading-1">
          Schedule{' '}
          <span className="text-text-tertiary">
            ({activeTable === 'Appointments' ? appointments.length : tasks.length})
          </span>
        </div>
        <div className="summary-labels flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className={`min-w-20 text-body-4 px-3 py-[5px] text-text-tertiary rounded-2xl! transition-all duration-300 ${activeTable === 'Appointments' ? ' bg-blue-light text-blue-text! border-text-brand! border' : 'border border-card-border! hover:bg-card-hover!'}`}
              onClick={() => setActiveTable('Appointments')}
            >
              Appointments
            </button>
            <button
              className={`min-w-20 text-body-4 px-3 py-[5px] text-text-tertiary rounded-2xl! transition-all duration-300 ${activeTable === 'Tasks' ? ' bg-blue-light text-blue-text! border-text-brand! border' : 'border border-card-border! hover:bg-card-hover!'}`}
              onClick={() => setActiveTable('Tasks')}
            >
              Tasks
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {activeLabels?.map((label) => (
              <button
                key={label.name}
                className={`min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! border border-card-border! transition-all duration-300 hover:bg-card-hover hover:border-card-hover!`}
                style={
                  label.key === activeSubLabel
                    ? {
                        background: label.bg,
                        color: label.text,
                      }
                    : {}
                }
                onClick={() => setActiveSubLabel(label.key)}
              >
                {label.name}
              </button>
            ))}
          </div>
        </div>
        {activeTable === 'Appointments' ? (
          <Appointments
            filteredList={filteredList}
            setActiveAppointment={setActiveAppointment}
            setViewPopup={setViewPopup}
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

        {activeAppointment && (
          <AppoitmentInfo
            showModal={viewPopup}
            setShowModal={setViewPopup}
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
