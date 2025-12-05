import { FormsProps } from "@/app/types/forms";
import React, { useEffect, useMemo, useState } from "react";
import Search from "../../Inputs/Search";

type FormsFiltersProps = {
  list: FormsProps[];
  setFilteredList: any;
};

const Categories = [
  {
    name: "All",
    key: "all",
  },
  {
    name: "Custom",
    key: "custom",
  },
  {
    name: "Library",
    key: "library",
  },
];

const FormsFilters = ({ list, setFilteredList }: FormsFiltersProps) => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  const filteredList = useMemo(() => {
    return list.filter((item) => {
      const matchesCategory =
        activeCategory === "all" ||
        item.category.toLowerCase() === activeCategory.toLowerCase();
      const matchesSearch = item.name
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [list, activeCategory, search]);

  useEffect(() => {
    setFilteredList(filteredList);
  }, [filteredList, setFilteredList]);

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {Categories.map((specie) => (
            <button
              key={specie.key}
              onClick={() => setActiveCategory(specie.key)}
              className={`min-w-20 h-9 rounded-xl! border font-satoshi! text-[15px]! font-bold hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${specie.key === activeCategory ? "border-blue-text! bg-blue-light! text-blue-text! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-[#302f2e]!"}`}
            >
              {specie.name}
            </button>
          ))}
        </div>
        <div className="flex">
          <Search value={search} setSearch={setSearch} />
        </div>
      </div>
    </div>
  );
};

export default FormsFilters;
