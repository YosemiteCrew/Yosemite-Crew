import React, { useEffect, useMemo, useState } from "react";
import { Invoice } from "@yosemite-crew/types";

const Category = [
  {
    name: "All",
    key: "all",
  },
];

const Statuses = [
  {
    name: "All",
    key: "all",
    bg: "#F1D4B0",
    text: "#000",
  },
  {
    name: "Pending",
    key: "pending",
    bg: "#747283",
    text: "#fff",
  },
  {
    name: "Awaiting payment",
    key: "awaiting_payment",
    bg: "#F1D4B0",
    text: "#000",
  },
  {
    name: "Paid",
    key: "paid",
    bg: "#D28F9A",
    text: "#fff",
  },
  {
    name: "Failed",
    key: "failed",
    bg: "#747283",
    text: "#fff",
  },
  {
    name: "Cancelled",
    key: "cancelled",
    bg: "#747283",
    text: "#fff",
  },
  {
    name: "Refunded",
    key: "refunded",
    bg: "#BF9FAA",
    text: "#fff",
  },
];

type InvoicesFiltersProps = {
  list: Invoice[];
  setFilteredList: React.Dispatch<React.SetStateAction<Invoice[]>>;
};

const InvoicesFilters = ({ list, setFilteredList }: InvoicesFiltersProps) => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");

  const filteredList = useMemo(() => {
    return list.filter((item: Invoice) => {
      const matchesStatus =
        activeStatus === "all" ||
        item.status.toLowerCase() === activeStatus.toLowerCase();
      const matchesCategory = activeCategory === "all";
      return matchesStatus && matchesCategory;
    });
  }, [list, activeCategory, activeStatus]);

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
              className={`min-w-20 text-body-4 px-3 py-[5px] text-text-tertiary rounded-2xl! transition-all duration-300 ${category.key === activeCategory ? " bg-blue-light text-blue-text! border-text-brand! border" : "border border-card-border! hover:bg-card-hover!"}`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {Statuses.map((status) => (
          <button
            key={status.key}
            className={`min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! ${status.key === activeStatus ? "border-text-primary! border" : ""}`}
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

export default InvoicesFilters;
