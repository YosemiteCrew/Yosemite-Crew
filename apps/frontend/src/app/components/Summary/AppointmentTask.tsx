"use client";
import React, { useEffect, useMemo, useState } from "react";
import Appointments from "../DataTable/Appointments";
import Tasks from "../DataTable/Tasks";

import { useAppointmentsForPrimaryOrg } from "@/app/hooks/useAppointments";
import { useTasksForPrimaryOrg } from "@/app/hooks/useTask";

import "./Summary.css";
import { Appointment } from "@yosemite-crew/types";
import AppoitmentInfo from "@/app/pages/Appointments/Sections/AppointmentInfo";
import { Task } from "@/app/types/task";
import TaskInfo from "@/app/pages/Tasks/Sections/TaskInfo";
import { PermissionGate } from "../PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
import Reschedule from "@/app/pages/Appointments/Sections/Reschedule";
import { usePermissions } from "@/app/hooks/usePermissions";

const AppointmentLabels = [
  {
    name: "No payment",
    key: "no_payment",
    bg: "#5C614B",
    text: "#fff",
  },
  {
    name: "Requested",
    key: "requested",
    bg: "#747283",
    text: "#fff",
  },
  {
    name: "Upcoming",
    key: "upcoming",
    bg: "#F1D4B0",
    text: "#000",
  },
  {
    name: "Checked-in",
    key: "checked_in",
    bg: "#A8A181",
    text: "#fff",
  },
  {
    name: "In progress",
    key: "in_progress",
    bg: "#BF9FAA",
    text: "#fff",
  },
  {
    name: "Completed",
    key: "completed",
    bg: "#D28F9A",
    text: "#fff",
  },
  {
    name: "Cancelled",
    key: "cancelled",
    bg: "#D9A488",
    text: "#fff",
  },
];
const TasksLabels = [
  {
    name: "Pending",
    key: "pending",
    bg: "#747283",
    text: "#fff",
  },
  {
    name: "In progress",
    key: "in_progress",
    bg: "#BF9FAA",
    text: "#fff",
  },
  {
    name: "Completed",
    key: "completed",
    bg: "#D28F9A",
    text: "#fff",
  },
  {
    name: "Cancelled",
    key: "cancelled",
    bg: "#D9A488",
    text: "#fff",
  },
];

const AppointmentTask = () => {
  const appointments = useAppointmentsForPrimaryOrg();
  const { can } = usePermissions();
  const canEditAppointments = can(PERMISSIONS.APPOINTMENTS_EDIT_ANY);
  const tasks = useTasksForPrimaryOrg();
  const [activeTable, setActiveTable] = useState("Appointments");
  const [viewPopup, setViewPopup] = useState(false);
  const [viewTaskPopup, setViewTaskPopup] = useState(false);
  const [reschedulePopup, setReschedulePopup] = useState(false);
  const [activeAppointment, setActiveAppointment] =
    useState<Appointment | null>(appointments[0] ?? null);
  const [activeTask, setActiveTask] = useState<Task | null>(tasks[0] ?? null);
  const activeLabels = useMemo(() => {
    return activeTable === "Appointments" ? AppointmentLabels : TasksLabels;
  }, [activeTable]);
  const [activeSubLabel, setActiveSubLabel] = useState(
    activeTable === "Appointments"
      ? AppointmentLabels[0].key
      : TasksLabels[0].key,
  );

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
    if (activeTable === "Appointments") {
      setActiveSubLabel(AppointmentLabels[0].key);
    } else {
      setActiveSubLabel(TasksLabels[0].key);
    }
  }, [activeTable]);

  const filteredList = useMemo(() => {
    if (activeTable === "Appointments") {
      return appointments.filter((item) => {
        const matchesStatus =
          item.status.toLowerCase() === activeSubLabel.toLowerCase();
        return matchesStatus;
      });
    }
    return [];
  }, [appointments, activeTable, activeSubLabel]);

  const filteredTaskList = useMemo(() => {
    if (activeTable === "Tasks") {
      return tasks.filter((item) => {
        const matchesStatus =
          item.status.toLowerCase() === activeSubLabel.toLowerCase();
        return matchesStatus;
      });
    }
    return [];
  }, [tasks, activeTable, activeSubLabel]);

  return (
    <PermissionGate
      allOf={[PERMISSIONS.APPOINTMENTS_VIEW_ANY, PERMISSIONS.TASKS_VIEW_ANY]}
    >
      <div className="summary-container">
        <div className="text-text-primary text-heading-1">
          Schedule{" "}
          <span className="text-text-tertiary">
            (
            {activeTable === "Appointments"
              ? appointments.length
              : tasks.length}
            )
          </span>
        </div>
        <div className="summary-labels flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className={`min-w-20 text-body-4 px-3 py-[5px] text-text-tertiary rounded-2xl! transition-all duration-300 ${activeTable === "Appointments" ? " bg-blue-light text-blue-text! border-text-brand! border" : "border border-card-border! hover:bg-card-hover!"}`}
              onClick={() => setActiveTable("Appointments")}
            >
              Appointments
            </button>
            <button
              className={`min-w-20 text-body-4 px-3 py-[5px] text-text-tertiary rounded-2xl! transition-all duration-300 ${activeTable === "Tasks" ? " bg-blue-light text-blue-text! border-text-brand! border" : "border border-card-border! hover:bg-card-hover!"}`}
              onClick={() => setActiveTable("Tasks")}
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
        {activeTable === "Appointments" ? (
          <Appointments
            filteredList={filteredList}
            setActiveAppointment={setActiveAppointment}
            setViewPopup={setViewPopup}
            setReschedulePopup={setReschedulePopup}
            canEditAppointments={canEditAppointments}
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
      </div>
    </PermissionGate>
  );
};

export default AppointmentTask;
