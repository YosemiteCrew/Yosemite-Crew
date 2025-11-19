import React, { useState, useEffect, useMemo } from "react";
import Search from "../../Inputs/Search";
import { CompanionProps } from "../../../pages/Companions/types";

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
  list: CompanionProps[];
  setFilteredList: any;
};

const CompanionFilters = ({ list, setFilteredList }: CompanionFiltersProps) => {
  const [activeSpecie, setActiveSpecie] = useState("all");
  const [activeStatus, setActiveStatus] = useState("active");
  const [search, setSearch] = useState("");

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchesStatus =
        item.status.toLowerCase() === activeStatus.toLowerCase();
      const matchesSpecie =
        activeSpecie === "all" ||
        item.species.toLowerCase() === activeSpecie.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.parent.toLowerCase().includes(search.toLowerCase());
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
