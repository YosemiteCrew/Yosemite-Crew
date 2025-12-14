import React, { useEffect, useMemo, useState } from "react";

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

type InventoryTurnoverFiltersProps = {
  list: any;
  setFilteredList: any;
};

const InventoryTurnoverFilters = ({
  list,
  setFilteredList,
}: InventoryTurnoverFiltersProps) => {
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredList = useMemo(() => {
    return list.filter((item: any) => {
      const matchesCategory =
        activeCategory === "all" ||
        (item.category || "").toLowerCase() === activeCategory.toLowerCase();
      return matchesCategory;
    });
  }, [list, activeCategory]);

  useEffect(() => {
    setFilteredList(filteredList);
  }, [filteredList, setFilteredList]);

  return (
    <div className="w-full flex items-center justify-between flex-wrap gap-2">
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
    </div>
  );
};

export default InventoryTurnoverFilters;
