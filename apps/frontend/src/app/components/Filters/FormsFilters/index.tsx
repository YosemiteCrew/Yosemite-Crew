import {
  FormsCategory,
  FormsCategoryOptions,
  FormsProps,
  FormsStatus,
  FormsStatusFilters,
} from "@/app/types/forms";
import React, { useEffect, useMemo, useState } from "react";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
import { getStatusStyle as getFormsStatusStyle } from "@/app/components/DataTable/FormsTable";

type FormsFiltersProps = {
  list: FormsProps[];
  setFilteredList: any;
};

const FormsFilters = ({ list, setFilteredList }: FormsFiltersProps) => {
  const [activeStatus, setActiveStatus] = useState<FormsStatus | "All">("All");
  const [activeCategory, setActiveCategory] = useState<FormsCategory | "All">(
    "All"
  );

  const categoryOptions = useMemo(
    () =>
      ["All", ...FormsCategoryOptions].map((cat) => ({
        label: cat,
        value: cat,
      })),
    []
  );

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchesStatus =
        activeStatus === "All" || item.status === activeStatus;
      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;
      return matchesStatus && matchesCategory;
    });
  }, [list, activeCategory, activeStatus]);

  useEffect(() => {
    setFilteredList(filteredList);
  }, [filteredList, setFilteredList]);

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {FormsStatusFilters.map((status) => {
          const active = status === activeStatus;
          const statusStyle =
            status === "All"
              ? { color: "#EAF3FF", backgroundColor: "#247AED" }
              : getFormsStatusStyle(status || "");

          return (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className="min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! border border-card-border! transition-all duration-300 hover:bg-card-hover hover:border-card-hover! text-text-tertiary"
              style={active ? statusStyle : undefined}
            >
              {status}
            </button>
          );
        })}
      </div>
      <div className="w-full sm:w-[220px] min-w-[180px]">
        <LabelDropdown
          placeholder="Category"
          options={categoryOptions}
          defaultOption={activeCategory}
          onSelect={(option) => {
            setActiveCategory(option.value as FormsCategory | "All");
          }}
        />
      </div>
    </div>
  );
};

export default FormsFilters;
