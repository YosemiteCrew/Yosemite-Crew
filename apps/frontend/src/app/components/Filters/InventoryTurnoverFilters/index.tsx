import React, { useEffect, useMemo, useState } from "react";

const Category = [
  { name: "All", key: "all", bg: "#247AED", text: "#EAF3FF" },
  { name: "Medicines", key: "medicine", bg: "#747283", text: "#F7F7F7" },
  { name: "Consumables", key: "consumable", bg: "#BF9FAA", text: "#F7F7F7" },
  { name: "Equipments", key: "equipment", bg: "#D9A488", text: "#F7F7F7" },
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
    <div className="w-full flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {Category.map((category) => (
          <button
            key={category.key}
            onClick={() => setActiveCategory(category.key)}
            className="min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! border border-card-border! transition-all duration-300 hover:bg-card-hover hover:border-card-hover! text-text-tertiary"
            style={
              category.key === activeCategory
                ? { backgroundColor: category.bg, color: category.text }
                : undefined
            }
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InventoryTurnoverFilters;
