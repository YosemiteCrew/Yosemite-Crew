import React, { useState, useEffect, useMemo } from "react";
import Search from "../../Inputs/Search";
import { AppointmentsProps } from "@/app/types/appointments";

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
    key: "checked-in",
    bg: "#FEF3E9",
    text: "#F68523",
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

type AppointmentFiltersProps = {
  list: AppointmentsProps[];
  setFilteredList: any;
};

const AppointmentFilters = ({
  list,
  setFilteredList,
}: AppointmentFiltersProps) => {
  const [activeType, setActiveType] = useState("all");
  const [activeStatus, setActiveStatus] = useState("requested");
  const [search, setSearch] = useState("");

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchesStatus =
        item.status.toLowerCase() === activeStatus.toLowerCase();
      const matchesType =
        activeType === "all" ||
        item.emergency ? "emergencies" : "all";
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [list, activeType, activeStatus, search]);

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
              className={`px-3 h-9 rounded-xl! border font-satoshi! text-[15px]! font-bold hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${type.key === activeType ? "border-blue-text! bg-blue-light! text-blue-text! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-[#302f2e]!"}`}
            >
              {type.name}
            </button>
          ))}
        </div>
        <div className="flex">
          <Search value={search} setSearch={setSearch} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {Statuses.map((status) => (
          <button
            key={status.key}
            className={`px-3 h-9 rounded-xl! font-satoshi! text-[15px]! font-bold hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${status.key === activeStatus ? "border! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-0!"}`}
            style={{
              background: status.bg,
              color: status.text,
              borderColor:
                status.key === activeStatus ? status.text : status.bg,
            }}
            onClick={() => setActiveStatus(status.key)}
          >
            {status.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AppointmentFilters;
