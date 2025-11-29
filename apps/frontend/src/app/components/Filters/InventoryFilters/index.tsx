import React, { useEffect, useMemo, useState } from "react";
import Search from "../../Inputs/Search";

const Category = [
  {
    name: "All",
    key: "all",
  },
  {
    name: "Medicines",
    key: "medicine",
  },
  {
    name: "Consumables",
    key: "consumable",
  },
  {
    name: "Equipments",
    key: "equipment",
  },
];

const Statuses = [
  {
    name: "This week",
    key: "this week",
    bg: "#E6F4EF",
    text: "#54B492",
  },
  {
    name: "Low stock",
    key: "low stock",
    bg: "#FEF3E9",
    text: "#F68523",
  },
  {
    name: "Expired",
    key: "expired",
    bg: "#FDEBEA",
    text: "#EA3729",
  },
  {
    name: "Hidden",
    key: "hidden",
    bg: "#EAEAEA",
    text: "#302F2E",
  },
];

type InventoryFiltersProps = {
  list: any;
  setFilteredList: any;
};

const InventoryFilters = ({ list, setFilteredList }: InventoryFiltersProps) => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeStatus, setActiveStatus] = useState("this week");
  const [search, setSearch] = useState("");

  const filteredList = useMemo(() => {
    return list.filter((item: any) => {
      const matchesStatus =
        item.basicInfo.status.toLowerCase() === activeStatus.toLowerCase();
      const matchesCategory =
        activeCategory === "all" ||
        item.basicInfo.category.toLowerCase() === activeCategory.toLowerCase();
      const matchesSearch =
        item.basicInfo.name.toLowerCase().includes(search.toLowerCase()) ||
        item.basicInfo.description.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [list, activeCategory, activeStatus, search]);

  useEffect(() => {
    setFilteredList(filteredList);
  }, [filteredList, setFilteredList]);

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {Category.map((category) => (
            <button
              key={category.key}
              onClick={() => setActiveCategory(category.key)}
              className={`px-3 h-9 rounded-xl! border font-satoshi! text-[15px]! font-bold hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${category.key === activeCategory ? "border-blue-text! bg-blue-light! text-blue-text! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-[#302f2e]!"}`}
            >
              {category.name}
            </button>
          ))}
        </div>
        <div className="flex">
          <Search value={search} setSearch={setSearch} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {Statuses.map((status) => (
          <button
            key={status.key}
            className={`px-2 h-9 rounded-xl! font-satoshi! text-[15px]! font-bold hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] ${status.key === activeStatus ? "border! shadow-[0_0_8px_0_rgba(0,0,0,0.16)]" : "border-0!"}`}
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

export default InventoryFilters;
