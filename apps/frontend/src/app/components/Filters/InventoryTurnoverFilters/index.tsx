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
            className={`min-w-20 text-body-4 px-3 py-[5px] text-text-tertiary rounded-2xl! transition-all duration-300 ${category.key === activeCategory ? "bg-blue-light text-blue-text! border-text-brand! border" : "border border-card-border! hover:bg-card-hover!"}`}
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InventoryTurnoverFilters;
