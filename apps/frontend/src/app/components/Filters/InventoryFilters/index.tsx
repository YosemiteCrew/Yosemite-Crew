import React, { useEffect, useMemo } from "react";
import { InventoryFiltersState } from "@/app/pages/Inventory/types";
import Search from "../../Inputs/Search";
import Dropdown from "../../Inputs/Dropdown/Dropdown";

const Statuses = [
  { name: "All", key: "ALL", bg: "#747283", text: "#F7F7F7" },
  { name: "Active", key: "ACTIVE", bg: "#F1D4B0", text: "#302f2e" },
  { name: "Hidden", key: "HIDDEN", bg: "#A8A181", text: "#F7F7F7" },
  { name: "Low stock", key: "LOW_STOCK", bg: "#BF9FAA", text: "#F7F7F7" },
  { name: "Expired", key: "EXPIRED", bg: "#D28F9A", text: "#F7F7F7" },
  { name: "Expiring soon", key: "EXPIRING_SOON", bg: "#5C614B", text: "#F7F7F7" },
  { name: "Healthy", key: "HEALTHY", bg: "#D9A488", text: "#F7F7F7" },
];

type InventoryFiltersProps = {
  filters: InventoryFiltersState;
  onChange: (filters: InventoryFiltersState) => void;
  categories: string[];
  loading?: boolean;
};

const InventoryFilters = ({
  filters,
  onChange,
  categories,
  loading = false,
}: InventoryFiltersProps) => {
  const categoryOptions = useMemo(
    () =>
      ["all", ...categories].map((cat) => ({
        label: cat === "all" ? "All categories" : cat,
        value: cat,
      })),
    [categories]
  );

  useEffect(() => {
    if (filters.category !== "all" && !categories.includes(filters.category)) {
      onChange({ ...filters, category: "all" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const updateFilters = (patch: Partial<InventoryFiltersState>) => {
    onChange({ ...filters, ...patch });
  };

  return (
    <div className="w-full flex flex-col gap-3 min-[1520px]:flex-row min-[1520px]:items-center min-[1520px]:justify-between">
      <div className="flex items-center gap-3 flex-1 flex-wrap">
        <div className="min-w-[220px]">
          <Dropdown
            placeholder="Category"
            value={filters.category}
            onChange={(val: string) => updateFilters({ category: val })}
            options={categoryOptions}
            className="min-h-12!"
            dropdownClassName="top-[55px]! !h-fit"
            disabled={loading}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap md:justify-start min-[1520px]:justify-end">
        {Statuses.map((status) => (
          <button
            key={status.key}
            disabled={loading}
            onClick={() => updateFilters({ status: status.key })}
            className={`min-w-20 text-body-4 px-3 py-[6px] rounded-2xl! border border-card-border! transition-all duration-300 hover:bg-card-hover hover:border-card-hover!`}
            style={
              status.key === filters.status
                ? {
                    backgroundColor: status.bg,
                    color: status.text,
                  }
                : undefined
            }
          >
            {status.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InventoryFilters;
