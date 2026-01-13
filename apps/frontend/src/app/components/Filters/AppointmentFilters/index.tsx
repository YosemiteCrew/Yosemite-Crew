import React, { useState, useEffect, useMemo } from "react";
import { Appointment } from "@yosemite-crew/types";

const Types = [
  {
    name: "All",
    key: "all",
  },
  {
    name: "Emergencies",
    key: "emergencies",
  },
];

const Statuses = [
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

type AppointmentFiltersProps = {
  list: Appointment[];
  setFilteredList: any;
};

const AppointmentFilters = ({
  list,
  setFilteredList,
}: AppointmentFiltersProps) => {
  const [activeType, setActiveType] = useState("all");
  const [activeStatus, setActiveStatus] = useState("upcoming");

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchesStatus =
        item.status.toLowerCase() === activeStatus.toLowerCase();
      const matchesType =
        activeType === "all" ||
        (activeType === "emergencies" && item.isEmergency);
      return matchesStatus && matchesType;
    });
  }, [list, activeType, activeStatus]);

  useEffect(() => {
    setFilteredList(filteredList);
  }, [filteredList, setFilteredList]);

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {Types.map((type) => (
            <button
              key={type.key}
              onClick={() => setActiveType(type.key)}
              className={`min-w-20 text-body-4 px-3 py-[5px] text-text-tertiary rounded-2xl! transition-all duration-300 ${type.key === activeType ? " bg-blue-light text-blue-text! border-text-brand! border" : "border border-card-border! hover:bg-card-hover!"}`}
            >
              {type.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {Statuses.map((status) => {
          return (
            <button
              key={status.key}
              className={`min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! border border-card-border! transition-all duration-300 hover:bg-card-hover hover:border-card-hover!`}
              style={
                status.key === activeStatus
                  ? {
                      background: status.bg,
                      color: status.text,
                    }
                  : {}
              }
              onClick={() => setActiveStatus(status.key)}
            >
              {status.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AppointmentFilters;
