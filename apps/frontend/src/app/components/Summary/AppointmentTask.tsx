"use client";
import React, { useMemo, useState } from "react";
import Appointments from "../DataTable/Appointments";
import Tasks from "../DataTable/Tasks";
import classNames from "classnames";
import Link from "next/link";

import "./Summary.css";
import { AppointmentsProps } from "@/app/types/appointments";
import { demoAppointments } from "@/app/pages/Appointments/demo";
import { TasksProps } from "@/app/types/tasks";
import { demoTasks } from "@/app/pages/Tasks/demo";

const AppointmentLabels = [
  {
    name: "Requested",
    value: "requested",
    background: "#eaeaea",
    color: "#302f2e",
  },
  {
    name: "Upcoming",
    value: "upcoming",
    background: "#247AED",
    color: "#fff",
  },
  {
    name: "Checked-in",
    value: "checked",
    background: "#FEF3E9",
    color: "#F68523",
  },
  {
    name: "In progress",
    value: "progress",
    background: "#E6F4EF",
    color: "#008F5D",
  },
  {
    name: "Completed",
    value: "post",
    background: "#008F5D",
    color: "#fff",
  },
];
const TasksLabels = [
  {
    name: "Upcoming",
    value: "upcoming",
    background: "#247AED",
    color: "#fff",
  },
  {
    name: "In progress",
    value: "progress",
    background: "#E6F4EF",
    color: "#008F5D",
  },
  {
    name: "Completed",
    value: "completed",
    background: "#008F5D",
    color: "#fff",
  },
];

const AppointmentTask = () => {
  const [list] = useState<AppointmentsProps[]>(demoAppointments);
  const [taskList] = useState<TasksProps[]>(demoTasks);
  const [activeTable, setActiveTable] = useState("Appointments");
  const activeLabels = useMemo(() => {
    return activeTable === "Appointments" ? AppointmentLabels : TasksLabels;
  }, [activeTable]);

  return (
    <div className="summary-container">
      <div className="summary-title">
        Schedule&nbsp;<span>(50)</span>
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
              className="summary-label-right"
              key={label.name}
              style={{ color: label.color, background: label.background }}
            >
              {label.name}
            </button>
          ))}
        </div>
      </div>
      {activeTable === "Appointments" ? (
        <Appointments filteredList={list} />
      ) : (
        <Tasks filteredList={taskList} />
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
