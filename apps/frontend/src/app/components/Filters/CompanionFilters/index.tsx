import React, { useState, useEffect, useMemo } from "react";
import Search from "../../Inputs/Search";
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
    bg: "#E6F4EF",
    text: "#54B492",
  },
  {
    name: "Inactive",
    key: "inactive",
    bg: "#FEF3E9",
    text: "#F68523",
  },
  {
    name: "Archived",
    key: "archived",
    bg: "#FDEBEA",
    text: "#EA3729",
  },
];

type CompanionFiltersProps = {
  list: CompanionParent[];
  setFilteredList: any;
};

const CompanionFilters = ({ list, setFilteredList }: CompanionFiltersProps) => {
  const [activeSpecie, setActiveSpecie] = useState("all");
  const [activeStatus, setActiveStatus] = useState("active");
  const [search, setSearch] = useState("");

  const filteredList = useMemo(() => {
    const searchLower = search.toLowerCase();
    const activeStatusLower = activeStatus.toLowerCase();
    const activeSpecieLower = activeSpecie.toLowerCase();

    return list.filter((item) => {
      const status = item.companion.status?.toLowerCase() ?? "inactive";
      const matchesStatus = status === activeStatusLower;
      const matchesSpecie =
        activeSpecie === "all" ||
        item.companion.type.toLowerCase() === activeSpecieLower;
      const matchesSearch =
        item.companion.name.toLowerCase().includes(searchLower) ||
        item.parent.firstName.toLowerCase().includes(searchLower);
      return matchesStatus && matchesSpecie && matchesSearch;
    });
  }, [list, activeSpecie, activeStatus, search]);

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
              className={`min-w-20 h-9 rounded-xl! border font-satoshi! text-[15px]! font-bold hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${specie.key === activeSpecie ? "border-blue-text! bg-blue-light! text-blue-text! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-[#302f2e]!"}`}
            >
              {specie.name}
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
            className={`min-w-20 h-9 rounded-xl! font-satoshi! text-[15px]! font-bold hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${status.key === activeStatus ? "border! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-0!"}`}
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

export default CompanionFilters;
