import React, { useState, useEffect, useMemo } from "react";
import { CompanionParent } from "@/app/pages/Companions/types";

const Species = [
  {
    name: "All",
    key: "all",
  },
  {
    name: "Dog",
    key: "dog",
  },
  {
    name: "Horse",
    key: "horse",
  },
  {
    name: "Cat",
    key: "cat",
  },
  {
    name: "Other",
    key: "other",
  },
];

const Statuses = [
  {
    name: "Active",
    key: "active",
    bg: "#D28F9A",
    text: "#fff",
  },
  {
    name: "Inactive",
    key: "inactive",
    bg: "#BF9FAA",
    text: "#fff",
  },
  {
    name: "Archived",
    key: "archived",
    bg: "#747283",
    text: "#fff",
  },
];

type CompanionFiltersProps = {
  list: CompanionParent[];
  setFilteredList: any;
};

const CompanionFilters = ({ list, setFilteredList }: CompanionFiltersProps) => {
  const [activeSpecie, setActiveSpecie] = useState("all");
  const [activeStatus, setActiveStatus] = useState("active");

  const filteredList = useMemo(() => {
    const activeStatusLower = activeStatus.toLowerCase();
    const activeSpecieLower = activeSpecie.toLowerCase();

    return list.filter((item) => {
      const status = item.companion.status?.toLowerCase() ?? "inactive";
      const matchesStatus = status === activeStatusLower;
      const matchesSpecie =
        activeSpecie === "all" ||
        item.companion.type.toLowerCase() === activeSpecieLower;
      return matchesStatus && matchesSpecie;
    });
  }, [list, activeSpecie, activeStatus]);

  useEffect(() => {
    setFilteredList(filteredList);
  }, [filteredList, setFilteredList]);

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {Species.map((specie) => (
            <button
              key={specie.key}
              onClick={() => setActiveSpecie(specie.key)}
              className={`min-w-20 text-body-4 px-3 py-[5px] text-text-tertiary rounded-2xl! transition-all duration-300 ${specie.key === activeSpecie ? " bg-blue-light text-blue-text! border-text-brand! border" : "border border-card-border! hover:bg-card-hover!"}`}
            >
              {specie.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {Statuses.map((status) => (
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
        ))}
      </div>
    </div>
  );
};

export default CompanionFilters;
