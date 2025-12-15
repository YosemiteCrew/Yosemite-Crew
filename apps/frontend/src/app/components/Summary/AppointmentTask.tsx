"use client";
import React, { useEffect, useMemo, useState } from "react";
import Appointments from "../DataTable/Appointments";
import Tasks from "../DataTable/Tasks";
import classNames from "classnames";
import Link from "next/link";

import "./Summary.css";
import { TasksProps } from "@/app/types/tasks";
import { demoTasks } from "@/app/pages/Tasks/demo";
import { useAppointmentsForPrimaryOrg } from "@/app/hooks/useAppointments";

const AppointmentLabels = [
  {
    name: "Requested",
    key: "requested",
    bg: "#eaeaea",
    text: "#302f2e",
  },
  {
    name: "Upcoming",
    key: "upcoming",
    bg: "#247AED",
    text: "#fff",
  },
  {
    name: "Checked-in",
    key: "checked_in",
    bg: "#FEF3E9",
    text: "#F68523",
  },
  {
    name: "In progress",
    key: "in_progress",
    bg: "#E6F4EF",
    text: "#54B492",
  },
  {
    name: "Completed",
    key: "completed",
    bg: "#008F5D",
    text: "#fff",
  },
];
const TasksLabels = [
  {
    name: "Upcoming",
    key: "upcoming",
    bg: "#247AED",
    text: "#fff",
  },
  {
    name: "In progress",
    key: "in-progress",
    bg: "#E6F4EF",
    text: "#54B492",
  },
  {
    name: "Completed",
    key: "completed",
    bg: "#008F5D",
    text: "#fff",
  },
];

const AppointmentTask = () => {
  const appointments = useAppointmentsForPrimaryOrg();
  const [taskList] = useState<TasksProps[]>(demoTasks);
  const [activeTable, setActiveTable] = useState("Appointments");
  const activeLabels = useMemo(() => {
    return activeTable === "Appointments" ? AppointmentLabels : TasksLabels;
  }, [activeTable]);
  const [activeSubLabel, setActiveSubLabel] = useState(
    activeTable === "Appointments"
      ? AppointmentLabels[0].key
      : TasksLabels[0].key
  );

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
      return taskList.filter((item) => {
        const matchesStatus =
          item.status.toLowerCase() === activeSubLabel.toLowerCase();
        return matchesStatus;
      });
    }
    return [];
  }, [taskList, activeTable, activeSubLabel]);

  return (
    <div className="summary-container">
      <div className="summary-title">
        Schedule{" "}
        <span>
          (
          {activeTable === "Appointments"
            ? appointments.length
            : taskList.length}
          )
        </span>
      </div>
      <div className="summary-labels">
        <div className="summary-labels-left">
          <button
            className={classNames("summary-label-left", {
              "active-label-left": activeTable === "Appointments",
            })}
            onClick={() => setActiveTable("Appointments")}
          >
            Appointments
          </button>
          <button
            className={classNames("summary-label-left", {
              "active-label-left": activeTable === "Tasks",
            })}
            onClick={() => setActiveTable("Tasks")}
          >
            Tasks
          </button>
        </div>
        <div className="summary-labels-right">
          {activeLabels?.map((label) => (
            <button
              className={`summary-label-right hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${label.key === activeSubLabel ? "border! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-0!"}`}
              key={label.name}
              style={{ color: label.text, background: label.bg }}
              onClick={() => setActiveSubLabel(label.key)}
            >
              {label.name}
            </button>
          ))}
        </div>
      </div>
      {activeTable === "Appointments" ? (
        <Appointments filteredList={filteredList.slice(0, 5)} hideActions />
      ) : (
        <Tasks filteredList={filteredTaskList.slice(0, 5)} hideActions />
      )}
      <div className="see-all-button">
        <Link
          className="see-all-button-link"
          href={activeTable === "Appointments" ? "/appoinments" : "/tasks"}
        >
          See all
        </Link>
      </div>
    </div>
  );
};

export default AppointmentTask;
