import {
  FormsCategory,
  FormsCategoryOptions,
  FormsProps,
  FormsStatus,
  FormsStatusFilters,
} from "@/app/types/forms";
import React, { useEffect, useMemo, useState } from "react";
import Search from "../../Inputs/Search";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";

type FormsFiltersProps = {
  list: FormsProps[];
  setFilteredList: any;
};

const FormsFilters = ({ list, setFilteredList }: FormsFiltersProps) => {
  const [activeStatus, setActiveStatus] = useState<FormsStatus | "All">("All");
  const [activeCategory, setActiveCategory] = useState<FormsCategory | "All">(
    "All"
  );
  const [search, setSearch] = useState("");

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchesStatus =
        activeStatus === "All" || item.status === activeStatus;
      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [list, activeCategory, activeStatus, search]);

  useEffect(() => {
    setFilteredList(filteredList);
  }, [filteredList, setFilteredList]);

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {FormsStatusFilters.map((status) => (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`min-w-30 h-10! rounded-xl! border font-satoshi! text-[15px]! font-bold hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${status === activeStatus ? "border-blue-text! bg-blue-light! text-blue-text! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-[#302f2e]!"}`}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="flex">
          <Dropdown
            placeholder="Category"
            value={activeCategory}
            onChange={(val) => {
              const next =
                (val as FormsCategory | "All") || "All";
              setActiveCategory(next);
            }}
            className="h-10! min-h-10! w-full sm:w-[220px]! min-w-[180px]!"
            dropdownClassName="top-[55px]! !h-fit min-w-[220px]! w-full sm:w-auto"
            options={["All", ...FormsCategoryOptions]}
          />
        </div>
        <div className="flex">
          <Search value={search} setSearch={setSearch} className="h-10! min-h-10!" />
        </div>
      </div>
    </div>
  );
};

export default FormsFilters;
